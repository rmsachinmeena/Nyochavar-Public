import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { userModel } from '../models/userModel.js';
import { issueSession, revokeAllSessionsForUser } from '../src/services/tokenService.js';
import { phoneVerificationService } from '../services/phoneVerificationService.js';

// The account that belongs to a mobile number (accounts made with only a number have a placeholder email)
const findAccountByPhone = async (phone) => {
  const { data } = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
  return data || userModel.findByEmail(`${phone}@placeholder.invalid`);
};

const lastTenDigits = (value) => String(value || '').replace(/\D/g, '').slice(-10);

export const phoneAuthController = {
  /**
   * Get public verification status & settings (e.g. is WhatsApp or Firebase active)
   */
  getPublicSettings: async (req, res) => {
    try {
      const settings = await phoneVerificationService.getSettings();
      res.status(200).json({
        success: true,
        activeProvider: settings.active_provider,
        whatsappEnabled: settings.whatsapp_enabled,
        firebaseEnabled: settings.firebase_enabled,
        otpExpiryMinutes: settings.otp_expiry_minutes,
      });
    } catch (error) {
      console.error('[PhoneAuthController] getPublicSettings error:', error);
      res.status(500).json({ success: false, error: 'Failed to retrieve verification settings' });
    }
  },

  /**
   * Send OTP to phone
   */
  sendOtp: async (req, res) => {
    try {
      const { phone } = req.body;
      const userId = req.auth?.id || null;

      if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone number is required.' });
      }

      // Create Account asks first: a number that already belongs to an account must not get a new code
      if (req.body.purpose === 'signup') {
        const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
        const { data: existingUser } = await supabase.from('users').select('id').eq('phone', cleanPhone).maybeSingle();
        if (existingUser) {
          return res.status(409).json({
            success: false,
            code: 'PHONE_EXISTS',
            error: 'This mobile number is already verified and has an account. Please sign in.',
          });
        }
      }

      const result = await phoneVerificationService.sendOtp({ phone, userId });
      res.status(200).json(result);
    } catch (error) {
      console.error('[PhoneAuthController] sendOtp error:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to send verification code.' });
    }
  },

  /**
   * Forgot password by mobile number: the number must belong to an account first, then a WhatsApp code is sent
   */
  forgotPassword: async (req, res) => {
    try {
      const phone = lastTenDigits(req.body.phone);
      if (phone.length !== 10) {
        return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number.' });
      }

      const user = await findAccountByPhone(phone);
      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'ACCOUNT_NOT_FOUND',
          error: 'No account found with this mobile number. Please check it or create an account.',
        });
      }

      await phoneVerificationService.sendOtp({ phone, userId: null });
      res.status(200).json({ success: true, message: `Verification code sent to +91 ${phone} via WhatsApp.` });
    } catch (error) {
      console.error('[PhoneAuthController] forgotPassword error:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to send the verification code.' });
    }
  },

  /**
   * Reset password with the WhatsApp code: a right code sets the new password and signs the account out everywhere
   */
  resetPassword: async (req, res) => {
    try {
      const phone = lastTenDigits(req.body.phone);
      const { otp, newPassword } = req.body;

      if (phone.length !== 10 || !otp || !newPassword) {
        return res.status(400).json({ success: false, error: 'Mobile number, code and new password are required.' });
      }
      if (String(newPassword).trim().length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      }

      const user = await findAccountByPhone(phone);
      if (!user) {
        return res.status(400).json({ success: false, error: 'Invalid or expired verification code.' });
      }

      // Throws with a clear message when the code is wrong, expired or tried too often
      await phoneVerificationService.verifyOtp({ phone, otp, userId: null, saveToAccount: false });

      const salt = await bcrypt.genSalt(10);
      await userModel.updatePassword(user.id, await bcrypt.hash(String(newPassword).trim(), salt));
      await revokeAllSessionsForUser('buyer', user.id);

      res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      console.error('[PhoneAuthController] resetPassword error:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to reset the password.' });
    }
  },

  /**
   * Verify entered OTP
   */
  verifyOtp: async (req, res) => {
    try {
      const { phone, otp } = req.body;
      const userId = req.auth?.id || null;

      if (!phone || !otp) {
        return res.status(400).json({ success: false, error: 'Phone number and verification code are required.' });
      }

      const result = await phoneVerificationService.verifyOtp({ phone, otp, userId, saveToAccount: req.body.save_to_account !== false });
      res.status(200).json(result);
    } catch (error) {
      console.error('[PhoneAuthController] verifyOtp error:', error);
      res.status(400).json({ success: false, error: error.message || 'Invalid or expired verification code.' });
    }
  },

  // Is this number already verified? (checkout and address forms ask before they ask for a new code)
  getStatus: async (req, res) => {
    try {
      const verified = await phoneVerificationService.isPhoneVerified({ phone: req.query.phone, userId: req.auth?.id || null });
      res.status(200).json({ success: true, verified });
    } catch (error) {
      console.error('[PhoneAuthController] getStatus error:', error);
      res.status(500).json({ success: false, error: 'Could not check this number' });
    }
  },

  /**
   * Complete phone verification via Firebase client auth
   */
  verifyFirebase: async (req, res) => {
    try {
      const { phone, idToken } = req.body;
      const userId = req.auth?.id || null;

      if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone number is required.' });
      }

      const result = await phoneVerificationService.verifyFirebasePhone({ phone, idToken, userId, saveToAccount: req.body.save_to_account !== false });
      res.status(200).json(result);
    } catch (error) {
      console.error('[PhoneAuthController] verifyFirebase error:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to complete Firebase verification.' });
    }
  },

  /**
   * Complete signup after phone OTP verification: creates user, hashes password, issues session
   */
  completePhoneSignup: async (req, res) => {
    try {
      const { name, phone, password, email } = req.body;
      const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);

      if (!cleanPhone || cleanPhone.length !== 10) {
        return res.status(400).json({ success: false, error: 'A valid 10-digit mobile number is required.' });
      }

      if (!password || password.trim().length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      }

      // Check if phone was verified in phone_verifications table
      const { data: record } = await supabase
        .from('phone_verifications')
        .select('*')
        .eq('phone', cleanPhone)
        .eq('is_verified', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!record) {
        return res.status(400).json({ success: false, error: 'Please verify your mobile number with OTP first.' });
      }

      // Check if phone already registered in users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email, phone')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ success: false, error: 'An account with this phone number already exists. Please sign in.' });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password.trim(), salt);

      // A sign-up by mobile number stores NO email: the email column stays empty until the customer adds their own
      const finalEmail = email?.trim().toLowerCase() || null;

      if (finalEmail) {
        const { data: existingEmailUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', finalEmail)
          .maybeSingle();

        if (existingEmailUser) {
          return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
        }
      }

      const newUser = await userModel.createUser({
        name: name?.trim() || `User ${cleanPhone.slice(-4)}`,
        email: finalEmail,
        password_hash,
        phone: cleanPhone,
        is_verified: true,
      });

      // The number was verified by the code above: from now on it is this account's fixed number
      await supabase
        .from('users')
        .update({ is_phone_verified: true, phone_verified_at: new Date().toISOString() })
        .eq('id', newUser.id);

      const { token, refreshToken, expiresIn } = await issueSession(
        'buyer',
        { id: newUser.id, email: newUser.email || '', name: newUser.name },
        res
      );

      res.status(200).json({
        success: true,
        message: 'Account created successfully!',
        token,
        refreshToken,
        expiresIn,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
        },
      });
    } catch (error) {
      console.error('[PhoneAuthController] completePhoneSignup error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to complete registration.' });
    }
  },
};

