import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { userModel } from '../models/userModel.js';
import { adminModel } from '../models/adminModel.js';
import { emailService } from '../services/emailService.js';
import { auditLogger } from '../services/auditLogger.js';
import { issueSession, revokeAllSessionsForUser } from '../src/services/tokenService.js';
import { generateOtp, otpExpiry, otpMatches } from '../src/services/otp.js';
import { adminLoginAttempts, claimOtpSend, loginAttempts, otpAttempts } from '../src/services/attemptGuard.js';
import { notifyUser } from '../services/notificationService.js';
import { pendingSignupModel } from '../models/pendingSignupModel.js';
import { supabase } from '../config/supabase.js';
import { phoneVerificationService } from '../services/phoneVerificationService.js';
import dotenv from 'dotenv';
dotenv.config();

// Accounts made with a mobile number only get a placeholder address on this domain
const PLACEHOLDER_DOMAIN = '@placeholder.invalid';

// The 10 digits of what the shopper typed, or null when they typed an email address
const typedPhone = (value) => (String(value).includes('@') ? null : String(value).replace(/\D/g, '').slice(-10));

// Finds an account by email address or mobile number
const findAccount = async (value) => {
  const phone = typedPhone(value);
  if (!phone) return userModel.findByEmail(String(value).trim().toLowerCase());
  const { data } = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
  return data || userModel.findByEmail(`${phone}${PLACEHOLDER_DOMAIN}`);
};

// Where a verification code for this account goes: WhatsApp (mobile number) or email, and a masked copy to show the shopper
const codeRoute = (user, typed) => {
  const realEmail = user.email && !user.email.endsWith(PLACEHOLDER_DOMAIN) ? user.email : null;
  const phone = user.phone ? String(user.phone).replace(/\D/g, '').slice(-10) : typedPhone(typed);
  let channel = typedPhone(typed) ? 'whatsapp' : 'email';
  if (channel === 'whatsapp' && !phone) channel = 'email';
  if (channel === 'email' && !realEmail) channel = 'whatsapp';
  if (channel === 'whatsapp') {
    return { channel, target: phone, otpLength: 6, sentTo: phone ? `+91 ••••••${phone.slice(-4)}` : 'your WhatsApp number' };
  }
  const [local, domain] = realEmail.split('@');
  return { channel, target: realEmail, otpLength: 4, sentTo: `${local.slice(0, 2)}•••@${domain}` };
};

// Compared against when the account does not exist, so "no such user" costs the same time as "wrong password"
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const lockedResponse = (res, seconds, what) =>
  res.status(429).json({
    success: false,
    code: 'ACCOUNT_LOCKED',
    retryAfter: seconds,
    error: `Too many wrong ${what} attempts. Try again in ${
      seconds > 2 * 60 * 60 ? `${Math.ceil(seconds / 3600)} hour(s)` : `${Math.ceil(seconds / 60)} minute(s)`
    }.`
  });

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

// Constant-time compare for legacy plaintext admin passwords (hashes of both sides -> equal length)
const safeEqual = (a, b) =>
  timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());

export const authController = {
  // Sign up a new user (Initiates OTP verification with email only; name & password set after OTP)
  signup: async (req, res) => {
    try {
      let { name, email, password } = req.body;
      email = email?.trim().toLowerCase();
      name = name?.trim();

      if (!email) {
        return res.status(400).json({ error: 'Email address is required' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }

      // Check if user already exists in database
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        if (existingUser.is_verified) {
          return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
        } else {
          // Account was created previously but not yet verified: Refresh OTP and allow verification!
          const otp = generateOtp();
          const otp_expiry = otpExpiry();
          await userModel.updateOTP(existingUser.id, otp, otp_expiry);
          await emailService.sendOTP(email, otp);

          return res.status(200).json({
            message: 'Your account is pending verification. A 4-digit OTP has been sent to your email.',
            requiresOtp: true,
            email
          });
        }
      }

      // Brand new email: nothing goes into `users` yet. The sign-up waits in `pending_signups` and becomes a real
      // account only when the OTP below is proven correct (see verifyOtp).
      const otp = generateOtp();
      const otp_expiry = otpExpiry();
      await pendingSignupModel.removeStale();
      await pendingSignupModel.save({ email, name: name || null, otp_code: otp, otp_expiry });

      // Send OTP via email (resilient)
      await emailService.sendOTP(email, otp);

      res.status(201).json({
        message: 'Signup initiated! Please verify your email with the OTP sent.',
        requiresOtp: true,
        email
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: error.message || 'Error during signup' });
    }
  },

  // Complete signup after OTP verification: user submits Full Name and Password to create account
  // (route is behind requireBuyer: the access token from /verify proves the OTP step was passed)
  completeSignup: async (req, res) => {
    try {
      const { name, password } = req.body;

      const user = await userModel.findById(req.auth.id);
      if (!user) {
        return res.status(404).json({ error: 'User account not found. Please try signing up again.' });
      }
      if (!user.is_verified) {
        return res.status(403).json({ error: 'Please verify your email with the OTP first.' });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      const updatedUser = await userModel.completeSignup(user.id, {
        name,
        password_hash
      });

      void notifyUser('welcome', { userId: updatedUser.id });

      // Fresh session carrying the updated full name
      const { token, refreshToken, expiresIn } = await issueSession(
        'buyer',
        { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name },
        res
      );

      res.status(200).json({
        success: true,
        message: 'Account created successfully!',
        token,
        refreshToken,
        expiresIn,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email
        }
      });
    } catch (error) {
      console.error('Complete signup error:', error);
      res.status(500).json({ error: error.message || 'Error completing account creation' });
    }
  },

  // Verify OTP for a new user
  verifyOtp: async (req, res) => {
    try {
      let { email, otp } = req.body;
      email = email?.trim().toLowerCase();

      if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
      }

      const lockedFor = otpAttempts.lockedFor(email);
      if (lockedFor > 0) return lockedResponse(res, lockedFor, 'code');

      const user = await userModel.findByEmail(email);
      if (!user) {
        // A new sign-up: it only exists in pending_signups until the code is right
        const pending = await pendingSignupModel.findByEmail(email);
        if (!pending) {
          otpAttempts.fail(email);
          return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        if (!otpMatches(pending.otp_code, otp)) {
          otpAttempts.fail(email);
          return res.status(400).json({ error: 'Invalid OTP' });
        }

        if (new Date(pending.otp_expiry) < new Date()) {
          return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        otpAttempts.reset(email);

        // The code is correct: only now does the account exist. The user sets the real password on the next step.
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(randomBytes(24).toString('hex'), salt);
        const createdUser = await userModel.createUser({
          name: pending.name || email.split('@')[0],
          email,
          password_hash,
          is_verified: true,
          role: 'buyer'
        });
        await pendingSignupModel.remove(email);

        const created = await issueSession(
          'buyer',
          { id: createdUser.id, email: createdUser.email, name: createdUser.name },
          res
        );

        return res.status(200).json({
          message: 'Email verified successfully',
          token: created.token,
          refreshToken: created.refreshToken,
          expiresIn: created.expiresIn,
          user: { id: createdUser.id, name: createdUser.name, email: createdUser.email }
        });
      }

      if (user.is_verified) {
        return res.status(400).json({ error: 'User is already verified' });
      }

      if (!otpMatches(user.otp_code, otp)) {
        otpAttempts.fail(email);
        return res.status(400).json({ error: 'Invalid OTP' });
      }

      // Check if OTP has expired
      if (new Date(user.otp_expiry) < new Date()) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }

      // Mark user as verified
      otpAttempts.reset(email);
      const verifiedUser = await userModel.verifyUser(user.id);

      const { token, refreshToken, expiresIn } = await issueSession(
        'buyer',
        { id: verifiedUser.id, email: verifiedUser.email, name: verifiedUser.name },
        res
      );

      res.status(200).json({
        message: 'Email verified successfully',
        token,
        refreshToken,
        expiresIn,
        user: {
          id: verifiedUser.id,
          name: verifiedUser.name,
          email: verifiedUser.email
        }
      });
    } catch (error) {
      console.error('OTP Verification error:', error);
      res.status(500).json({ error: error.message || 'Error verifying OTP' });
    }
  },

  // Resend OTP
  resendOtp: async (req, res) => {
    try {
      let { email } = req.body;
      email = email?.trim().toLowerCase();
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      if (!claimOtpSend(email)) {
        return res.status(429).json({ success: false, code: 'OTP_COOLDOWN', error: 'Please wait 30 seconds before requesting another code.' });
      }

      const user = await userModel.findByEmail(email);
      if (!user) {
        // A sign-up that is still waiting for its code gets a fresh one
        const pending = await pendingSignupModel.findByEmail(email);
        if (pending) {
          const newOtp = generateOtp();
          await pendingSignupModel.updateOtp(email, newOtp, otpExpiry());
          await emailService.sendOTP(email, newOtp);
        }
        // Same reply whether or not there was anything to resend: do not reveal which emails are known
        return res.status(200).json({ message: 'OTP resent successfully' });
      }

      if (user.is_verified) {
        return res.status(400).json({ error: 'User is already verified' });
      }

      // Generate a new 4-digit OTP
      const otp = generateOtp();
      const otp_expiry = otpExpiry();

      // Update OTP in DB
      await userModel.updateOTP(user.id, otp, otp_expiry);

      // Send OTP via email
      await emailService.sendOTP(email, otp);

      res.status(200).json({ message: 'OTP resent successfully' });
    } catch (error) {
      console.error('Resend OTP error:', error);
      res.status(500).json({ error: error.message || 'Error resending OTP' });
    }
  },

  // Sign-in step 1: the shopper typed an email or mobile number. Says whether the account is unknown, ready for a password,
  // or needs a code first (not verified yet, or a Google-only account with no password): in that case the code is sent now.
  identify: async (req, res) => {
    try {
      const { identifier } = req.body;
      const user = await findAccount(identifier);
      if (!user) return res.status(200).json({ success: true, status: 'not_found' });

      if (user.is_verified && user.auth_provider !== 'google') {
        return res.status(200).json({ success: true, status: 'password' });
      }

      const route = codeRoute(user, identifier);
      if (route.channel === 'email') {
        if (!claimOtpSend(route.target)) {
          return res.status(429).json({ success: false, code: 'OTP_COOLDOWN', error: 'Please wait 30 seconds before requesting another code.' });
        }
        const otp = generateOtp();
        await userModel.updateOTP(user.id, otp, otpExpiry());
        await emailService.sendOTP(route.target, otp);
      } else {
        try {
          await phoneVerificationService.sendOtp({ phone: route.target, userId: null });
        } catch (sendError) {
          return res.status(400).json({ success: false, error: sendError.message || 'Could not send the verification code.' });
        }
      }

      res.status(200).json({
        success: true,
        status: 'verify',
        channel: route.channel,
        otpLength: route.otpLength,
        sentTo: route.sentTo,
        // Google-only accounts are told why they are asked for a code
        needsPassword: user.auth_provider === 'google'
      });
    } catch (error) {
      console.error('Identify error:', error);
      res.status(500).json({ error: 'Could not check this account. Please try again.' });
    }
  },

  // Sign-in step 2 for an account that needs a code: a right code verifies the account and opens a session, so the
  // shopper can then choose a password (PUT /users/set-password/:id)
  verifyAccount: async (req, res) => {
    try {
      const { identifier, otp } = req.body;
      const user = await findAccount(identifier);
      if (!user) return res.status(400).json({ error: 'Invalid or expired OTP' });

      const key = `account:${user.id}`;
      const lockedFor = otpAttempts.lockedFor(key);
      if (lockedFor > 0) return lockedResponse(res, lockedFor, 'code');

      const route = codeRoute(user, identifier);
      if (route.channel === 'email') {
        if (!otpMatches(user.otp_code, otp)) {
          otpAttempts.fail(key);
          return res.status(400).json({ error: 'Invalid OTP' });
        }
        if (new Date(user.otp_expiry) < new Date()) {
          return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }
      } else {
        try {
          await phoneVerificationService.verifyOtp({ phone: route.target, otp, userId: null, saveToAccount: false });
        } catch (verifyError) {
          otpAttempts.fail(key);
          return res.status(400).json({ error: verifyError.message || 'Invalid OTP' });
        }
        await supabase.from('users').update({ is_phone_verified: true, phone_verified_at: new Date().toISOString() }).eq('id', user.id);
      }

      otpAttempts.reset(key);
      const verified = await userModel.verifyUser(user.id);
      const { token, refreshToken, expiresIn } = await issueSession(
        'buyer',
        { id: verified.id, email: verified.email, name: verified.name },
        res
      );

      res.status(200).json({
        message: 'Verified successfully',
        token,
        refreshToken,
        expiresIn,
        user: { id: verified.id, name: verified.name, email: verified.email, phone: verified.phone }
      });
    } catch (error) {
      console.error('Verify account error:', error);
      res.status(500).json({ error: 'Could not verify this account. Please try again.' });
    }
  },

  // Login existing user
  login: async (req, res) => {
    try {
      let { email, password } = req.body;
      email = email?.trim().toLowerCase();

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const lockedFor = loginAttempts.lockedFor(email);
      if (lockedFor > 0) return lockedResponse(res, lockedFor, 'login');

      // Support login by either Email or 10-digit Mobile Number
      const user = await findAccount(email);

      if (!user) {
        await bcrypt.compare(password, DUMMY_HASH);
        loginAttempts.fail(email);
        return res.status(400).json({ error: 'Invalid email or password' });
      }

      if (!user.is_verified) {
        const otp = generateOtp();
        const otp_expiry = otpExpiry();
        await userModel.updateOTP(user.id, otp, otp_expiry);
        await emailService.sendOTP(user.email, otp);

        return res.status(403).json({
          error: 'Your email is not verified yet. We have sent a 4-digit OTP to your email.',
          requiresOtp: true,
          email: user.email
        });
      }

      // Google-only accounts have no password the user knows: point them to the Google button
      if (user.auth_provider === 'google') {
        return res.status(400).json({ error: 'This account uses Google sign-in. Please continue with Google.' });
      }

      // Compare passwords
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        loginAttempts.fail(email);
        return res.status(400).json({ error: 'Invalid email or password' });
      }
      loginAttempts.reset(email);

      const { token, refreshToken, expiresIn } = await issueSession(
        'buyer',
        { id: user.id, email: user.email, name: user.name },
        res
      );

      res.status(200).json({
        message: 'Login successful',
        token,
        refreshToken,
        expiresIn,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: error.message || 'Error during login' });
    }
  },

  // SuperAdmin Login: bcrypt-hashed passwords; legacy plaintext rows are upgraded to a hash on first successful login
  adminLogin: async (req, res) => {
    try {
      let { email, password } = req.body;
      email = email?.trim().toLowerCase();

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const lockedFor = adminLoginAttempts.lockedFor(email);
      if (lockedFor > 0) return lockedResponse(res, lockedFor, 'admin login');

      const admin = await adminModel.findByEmail(email);
      if (!admin) {
        await bcrypt.compare(password, DUMMY_HASH);
        adminLoginAttempts.fail(email);
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      if (admin.is_active === false) {
        return res.status(403).json({ error: 'Admin account is deactivated' });
      }

      const stored = admin.password;
      const isHashed = isBcryptHash(stored);
      const isMatch = isHashed ? await bcrypt.compare(password, stored) : stored != null && safeEqual(stored, password);
      if (!isMatch) {
        adminLoginAttempts.fail(email);
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }
      adminLoginAttempts.reset(email);

      if (!isHashed) {
        // First login since hashing was introduced: replace the plaintext with a bcrypt hash
        try {
          await adminModel.updatePassword(admin.id, await bcrypt.hash(password, 10));
        } catch (upgradeError) {
          console.error('Admin password hash upgrade failed:', upgradeError.message);
        }
      }

      const { token, refreshToken, expiresIn } = await issueSession(
        'superadmin',
        { id: admin.id, email: admin.email, name: admin.name },
        res
      );

      // Log admin login to audit table
      await auditLogger.log({
        admin_id: admin.id,
        action: 'ADMIN_LOGIN',
        table_affected: 'admins',
        record_id: admin.id
      });

      res.status(200).json({
        success: true,
        message: 'SuperAdmin login successful',
        token,
        refreshToken,
        expiresIn,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role || 'superadmin'
        }
      });
    } catch (error) {
      console.error('SuperAdmin login error:', error);
      res.status(500).json({ error: error.message || 'SuperAdmin authentication failed' });
    }
  },

  // Does an account exist for this email? Status code only, nothing about the account is returned:
  // 204 = account exists, 404 = it does not. Strictly rate limited (see config/rateLimits.ts).
  checkEmail: async (req, res) => {
    try {
      const email = req.body.email?.trim().toLowerCase();
      if (!email) return res.sendStatus(400);

      const user = await userModel.findByEmail(email);
      return res.sendStatus(user ? 204 : 404);
    } catch (error) {
      console.error('Check email error:', error);
      return res.sendStatus(500);
    }
  },

  // Forgot Password
  forgotPassword: async (req, res) => {
    try {
      let { email } = req.body;
      email = email?.trim().toLowerCase();
      
      if (!email) return res.status(400).json({ error: 'Email is required' });

      // Same reply whether or not the account exists, so this cannot be used to probe for customers
      const genericReply = { message: 'If an account exists for this email, a reset code has been sent.' };
      const user = await userModel.findByEmail(email);
      if (!user || !claimOtpSend(email)) return res.status(200).json(genericReply);

      // Generate OTP
      const otp = generateOtp();
      const otp_expiry = otpExpiry();

      await userModel.updateOTP(user.id, otp, otp_expiry);
      await emailService.sendOTP(email, otp, 'reset');

      res.status(200).json(genericReply);
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: error.message || 'Error sending password reset email' });
    }
  },

  // Reset Password
  resetPassword: async (req, res) => {
    try {
      let { email, otp, newPassword } = req.body;
      email = email?.trim().toLowerCase();
      
      if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: 'Email, OTP, and new password are required' });
      }

      const lockedFor = otpAttempts.lockedFor(email);
      if (lockedFor > 0) return lockedResponse(res, lockedFor, 'code');

      const user = await userModel.findByEmail(email);
      if (!user) {
        otpAttempts.fail(email);
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      // Check OTP
      if (!otpMatches(user.otp_code, otp)) {
        otpAttempts.fail(email);
        return res.status(400).json({ error: 'Invalid OTP' });
      }

      if (new Date(user.otp_expiry) < new Date()) {
        return res.status(400).json({ error: 'OTP has expired' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(newPassword, salt);

      // Update password
      await userModel.updatePassword(user.id, password_hash);
      otpAttempts.reset(email);

      // A reset means the old password may be compromised: sign the user out everywhere
      await revokeAllSessionsForUser('buyer', user.id);

      res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: error.message || 'Error resetting password' });
    }
  },

  // Google OAuth Login / Auto-Signup
  googleAuth: async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ error: 'Google credential token is required' });
      }

      // Verify token with Google tokeninfo endpoint
      const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!googleResponse.ok) {
        return res.status(401).json({ error: 'Invalid Google token' });
      }

      const payload = await googleResponse.json();

      // The token must have been issued to *our* Google client and for a verified address
      if (process.env.GOOGLE_CLIENT_ID && payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        return res.status(401).json({ error: 'Invalid Google token' });
      }
      if (String(payload.email_verified) !== 'true') {
        return res.status(401).json({ error: 'Your Google email address is not verified' });
      }

      const email = payload.email?.trim().toLowerCase();
      const googleId = payload.sub ? String(payload.sub) : '';

      if (!email || !googleId) {
        return res.status(400).json({ error: 'Google account does not provide an email address' });
      }

      const name = payload.name || payload.given_name || email.split('@')[0];

      // Google already proved the user owns this address (email_verified above), so no email OTP is needed.
      const respondWithSession = async (sessionUser, isNewUser, message, alreadyRegistered = false) => {
        if (isNewUser) void notifyUser('welcome', { userId: sessionUser.id });
        const { token, refreshToken, expiresIn } = await issueSession(
          'buyer',
          { id: sessionUser.id, email: sessionUser.email, name: sessionUser.name },
          res
        );

        return res.status(200).json({
          message,
          requiresOtp: false,
          // True only the first time this person signs up; the client logs them straight in (no password step)
          isNewUser,
          // True when this verified email already had an account (the sign-up page warns about it)
          alreadyRegistered,
          token,
          refreshToken,
          expiresIn,
          user: {
            id: sessionUser.id,
            name: sessionUser.name,
            email: sessionUser.email,
            role: sessionUser.role || 'buyer',
            is_verified: true
          }
        });
      };

      // Check if user already exists in DB
      let user = await userModel.findByEmail(email);

      if (!user) {
        // First time Google user: create a verified account. No password is ever asked; the stored hash is a
        // random secret nobody knows, so only Google can sign this account in.
        const randomSecret = randomBytes(24).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(randomSecret, salt);

        const { data: newUser, error: createErr } = await userModel.createOAuthUser({
          name,
          email,
          password_hash,
          is_verified: true,
          role: 'buyer',
          google_id: googleId,
          auth_provider: 'google'
        });

        if (createErr || !newUser) {
          throw new Error(createErr?.message || 'Failed to create user in database');
        }

        return respondWithSession(newUser, true, 'Welcome! Your account is ready.');
      }

      // The email already belongs to a different Google account: never let this token in
      if (user.google_id && user.google_id !== googleId) {
        return res.status(401).json({ error: 'This email is linked to a different Google account' });
      }

      // Existing account without a Google link yet (email signup, possibly never verified): link it now.
      // Google proved the address, so this also verifies it.
      if (!user.google_id) {
        const wasVerified = user.is_verified;
        const linkedUser = await userModel.linkGoogleAccount(user.id, googleId);
        return respondWithSession(linkedUser, !wasVerified, wasVerified ? 'Google login successful' : 'Welcome! Your account is ready.', wasVerified);
      }

      // Returning Google user: log in directly
      return respondWithSession(user, false, 'Google login successful', true);
    } catch (error) {
      console.error('Google Auth error:', error);
      res.status(500).json({ error: error.message || 'Error processing Google login' });
    }
  }
};
