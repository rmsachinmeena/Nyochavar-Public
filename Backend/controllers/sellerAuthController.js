import bcrypt from 'bcryptjs';
import { sellerModel, formatSeller, normalizePhone } from '../models/sellerModel.js';
import { signSellerToken } from '../config/sellerAuth.js';
import { emailService } from '../services/emailService.js';
import { whatsappBotService } from '../services/whatsappBotService.js';
import { phoneVerificationService } from '../services/phoneVerificationService.js';

// Constant dummy hash to prevent timing attacks when an account does not exist
const DUMMY_HASH = bcrypt.hashSync('dummy-not-a-real-seller-password', 10);

const RESET_CODE_MINUTES = 10;
const MAX_RESET_ATTEMPTS = 5;

const maskPhone = (phone) => `+91 ••••••${normalizePhone(phone).slice(-4)}`;
const maskEmail = (email) => {
  const [local, domain] = String(email).split('@');
  return `${local.slice(0, 2)}•••@${domain}`;
};

const maskIdentifier = (identifier) => {
  if (!identifier) return '';
  const str = String(identifier).trim();
  return str.includes('@') ? maskEmail(str) : maskPhone(str);
};

/**
 * Sends the password-reset code. It follows the same switch as the shoppers' codes (admin panel > Automation):
 * a mobile number goes on WhatsApp while WhatsApp verification is ON; an email, or WhatsApp being OFF or offline, goes by email.
 * Returns where it went, or throws when nothing could deliver it.
 */
const deliverResetCode = async (seller, identifier, code) => {
  const typedPhone = !String(identifier).includes('@');

  let whatsappOn = false;
  try {
    const settings = await phoneVerificationService.getSettings();
    whatsappOn = Boolean(settings.whatsapp_enabled) && settings.active_provider !== 'disabled';
  } catch {
    // settings unreadable: use email
  }

  if (typedPhone && whatsappOn && seller.phone) {
    const text = `🔐 *Nyochavar Seller Hub*\n\nYour password reset code is: *${code}*\n\nValid for ${RESET_CODE_MINUTES} minutes. Do not share this code with anyone.`;
    const result = await whatsappBotService.sendMessage(seller.phone, text);
    // A simulated send means the bot is offline: fall through to email instead of pretending the code was sent
    if (result?.success && !result.simulated) return { channel: 'whatsapp', sentTo: maskPhone(seller.phone) };
  }

  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
    <h2 style="margin:0 0 12px">Reset your Nyochavar seller password</h2>
    <p style="color:#475569">Use this code to choose a new password:</p>
    <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:16px 0">${code}</p>
    <p style="color:#64748b;font-size:13px">The code is valid for ${RESET_CODE_MINUTES} minutes. If you did not ask for it, ignore this email.</p>
  </div>`;
  const sent = await emailService.sendMessage(seller.email, 'Your Nyochavar seller password reset code', html);
  if (!sent) throw new Error('We could not send the verification code. Please try again in a moment.');
  return { channel: 'email', sentTo: maskEmail(seller.email) };
};

export const sellerAuthController = {
  /**
   * Step 1 of login: Check if the seller account exists by email or mobile.
   */
  identify: async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier || !String(identifier).trim()) {
        return res.status(400).json({ error: 'Please enter your email or 10-digit mobile number' });
      }

      const seller = await sellerModel.findAuthByIdentifier(identifier);
      if (!seller) {
        return res.status(200).json({ status: 'not_found' });
      }

      return res.status(200).json({
        status: 'password',
        masked: maskIdentifier(identifier),
      });
    } catch (err) {
      console.error('Error in seller identify:', err);
      return res.status(500).json({ error: 'Failed to verify seller account' });
    }
  },

  /**
   * Step 2 of login: Authenticate with password.
   */
  login: async (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Email/phone and password are required' });
      }

      const seller = await sellerModel.findAuthByIdentifier(identifier);
      const hashToCompare = seller?.password_hash || DUMMY_HASH;
      const isMatch = await bcrypt.compare(String(password), hashToCompare);

      if (!seller || !isMatch) {
        return res.status(401).json({ error: 'Invalid email/mobile or password. Please try again.' });
      }

      if (seller.status === 'suspended' || seller.is_active === false) {
        return res.status(403).json({ error: 'Your seller account has been suspended. Please contact partner support.' });
      }

      return res.status(200).json({
        success: true,
        token: signSellerToken(seller),
        seller: formatSeller(seller),
      });
    } catch (err) {
      console.error('Error in seller login:', err);
      return res.status(500).json({ error: 'Failed to sign in. Please try again.' });
    }
  },

  /**
   * Register a new seller and their store.
   */
  register: async (req, res) => {
    try {
      const {
        storeName,
        ownerName,
        email,
        phone,
        password,
        category,
        pincode,
        streetAddress,
        city,
        pickupSlot,
        payoutMethod,
        upiId,
        bankDetails,
      } = req.body;

      // 1. Validation
      if (!storeName || !String(storeName).trim()) {
        return res.status(400).json({ error: 'Store or brand name is required' });
      }

      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone || cleanPhone.length !== 10) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
      }

      const cleanEmail = String(email || '').trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid business email address' });
      }

      if (!password || String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      // 2. Duplicate Check
      const existingEmail = await sellerModel.findByEmail(cleanEmail);
      if (existingEmail) {
        return res.status(409).json({ error: 'A seller account with this email already exists. Please log in.' });
      }

      const existingPhone = await sellerModel.findByPhone(cleanPhone);
      if (existingPhone) {
        return res.status(409).json({ error: 'A seller account with this mobile number already exists. Please log in.' });
      }

      // 3. Password Hashing
      const passwordHash = await bcrypt.hash(String(password), 10);

      // 4. Create Seller in DB
      const newSeller = await sellerModel.create({
        store_name: storeName,
        owner_name: ownerName || storeName,
        email: cleanEmail,
        phone: cleanPhone,
        password_hash: passwordHash,
        category: category || 'Gourmet Hampers & Sweets',
        pincode: pincode || null,
        street_address: streetAddress || null,
        city: city || 'Jaipur',
        pickup_slot: pickupSlot || 'Morning (10:00 AM - 01:00 PM)',
        payout_method: payoutMethod || 'upi',
        upi_id: upiId || null,
        bank_details: bankDetails || {},
        status: 'active',
        is_active: true,
        kyc_status: 'verified',
      });

      return res.status(201).json({
        success: true,
        token: signSellerToken(newSeller),
        seller: newSeller,
      });
    } catch (err) {
      console.error('Error in seller registration:', err);
      return res.status(500).json({ error: err.message || 'Failed to register seller account' });
    }
  },

  /**
   * Request password reset code
   */
  sendResetCode: async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ error: 'Email or mobile number is required' });
      }

      const seller = await sellerModel.findAuthByIdentifier(identifier);
      if (!seller) {
        return res.status(200).json({ status: 'not_found' });
      }

      // 6-digit numeric OTP
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const otpHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + RESET_CODE_MINUTES * 60 * 1000).toISOString();

      await sellerModel.saveResetOtp(seller.id, { otpHash, expiresAt });

      const delivered = await deliverResetCode(seller, identifier, code);

      return res.status(200).json({ status: 'sent', sentTo: delivered.sentTo, channel: delivered.channel });
    } catch (err) {
      console.error('Error sending reset code:', err);
      return res.status(500).json({ error: err.message || 'Could not send verification code' });
    }
  },

  /**
   * Complete password reset with code
   */
  resetPassword: async (req, res) => {
    try {
      const { identifier, code, newPassword } = req.body;
      if (!identifier || !code || !newPassword) {
        return res.status(400).json({ error: 'Identifier, code, and new password are required' });
      }

      if (String(newPassword).length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      const seller = await sellerModel.findAuthByIdentifier(identifier);
      if (!seller || !seller.reset_otp_hash) {
        return res.status(400).json({ error: 'No active reset request found for this account' });
      }

      const attempts = Number(seller.reset_attempts) || 0;
      if (attempts >= MAX_RESET_ATTEMPTS) {
        await sellerModel.clearResetOtp(seller.id);
        return res.status(429).json({ error: 'Too many wrong codes. Please request a new code.' });
      }

      if (new Date(seller.reset_otp_expires_at) < new Date()) {
        return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
      }

      const isOtpValid = await bcrypt.compare(String(code).trim(), seller.reset_otp_hash);
      if (!isOtpValid) {
        await sellerModel.bumpResetAttempts(seller.id, attempts + 1);
        const left = MAX_RESET_ATTEMPTS - (attempts + 1);
        return res.status(400).json({
          error: left > 0 ? `Invalid verification code. ${left} attempt(s) left.` : 'Invalid verification code. Please request a new code.',
        });
      }

      const passwordHash = await bcrypt.hash(String(newPassword), 10);
      await sellerModel.updatePassword(seller.id, passwordHash);

      return res.status(200).json({
        success: true,
        message: 'Password reset successful. You can now sign in with your new password.',
      });
    } catch (err) {
      console.error('Error resetting seller password:', err);
      return res.status(500).json({ error: 'Failed to reset password' });
    }
  },

  /**
   * Get current authenticated seller profile (the route runs requireSeller first)
   */
  getMe: async (req, res) => res.status(200).json({ success: true, seller: req.seller }),
};
