import crypto from 'node:crypto';
import { supabase } from '../config/supabase.js';
import { whatsappBotService } from './whatsappBotService.js';

// Cache settings in memory with a 30-second TTL to avoid slamming DB
let cachedSettings = null;
let cachedSettingsAt = 0;

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return digits; // standard 10 digit Indian number
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
};

// Per number: at most 10 "send code" requests in 60 seconds. The 11th blocks that number from getting codes for 20 minutes.
// Kept in memory (it starts fresh when the server restarts).
const SEND_LIMIT = 10;
const SEND_WINDOW_MS = 60_000;
const SEND_BLOCK_MS = 20 * 60_000;
const sendTracker = new Map(); // phone -> { hits: number[], blockedUntil: number }

const checkSendLimit = (phone) => {
  const now = Date.now();
  const entry = sendTracker.get(phone) || { hits: [], blockedUntil: 0 };

  if (entry.blockedUntil > now) {
    const minutes = Math.ceil((entry.blockedUntil - now) / 60_000);
    throw new Error(`Too many code requests for this number. Please try again in ${minutes} minute(s).`);
  }

  entry.hits = entry.hits.filter((time) => now - time < SEND_WINDOW_MS);
  entry.hits.push(now);
  if (entry.hits.length > SEND_LIMIT) {
    entry.hits = [];
    entry.blockedUntil = now + SEND_BLOCK_MS;
    sendTracker.set(phone, entry);
    throw new Error('Too many code requests for this number. Please try again in 20 minutes.');
  }
  sendTracker.set(phone, entry);
};

// Forget numbers that are neither blocked nor recently used
setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of sendTracker) {
    if (entry.blockedUntil <= now && entry.hits.every((time) => now - time >= SEND_WINDOW_MS)) sendTracker.delete(phone);
  }
}, 5 * 60_000).unref();

// The first number an account verifies is final: a later verification of another number never replaces it
const canSaveAsAccountNumber = async (userId, cleanPhone) => {
  const { data: user } = await supabase.from('users').select('phone, is_phone_verified').eq('id', userId).maybeSingle();
  if (!user?.is_phone_verified) return true;
  return normalizePhone(user.phone) === cleanPhone;
};

export const phoneVerificationService = {
  /**
   * Fetch current verification settings (active provider, toggles, expiry)
   */
  getSettings: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedSettings && now - cachedSettingsAt < 30_000) {
      return cachedSettings;
    }

    try {
      const { data, error } = await supabase
        .from('verification_settings')
        .select('*')
        .eq('id', 'global')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[PhoneVerification] Error fetching settings:', error);
      }

      cachedSettings = data || {
        id: 'global',
        active_provider: 'whatsapp',
        whatsapp_enabled: true,
        firebase_enabled: false,
        otp_expiry_minutes: 5,
        max_attempts: 5,
      };
      cachedSettingsAt = now;
      return cachedSettings;
    } catch (err) {
      console.error('[PhoneVerification] Failed to get verification settings:', err);
      return {
        id: 'global',
        active_provider: 'whatsapp',
        whatsapp_enabled: true,
        firebase_enabled: false,
        otp_expiry_minutes: 5,
        max_attempts: 5,
      };
    }
  },

  /**
   * Update superadmin verification settings
   */
  updateSettings: async (updates) => {
    const allowed = ['active_provider', 'whatsapp_enabled', 'firebase_enabled', 'otp_expiry_minutes', 'max_attempts'];
    const payload = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (updates[key] !== undefined) payload[key] = updates[key];
    }

    const { data, error } = await supabase
      .from('verification_settings')
      .upsert({ id: 'global', ...payload })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update verification settings: ${error.message}`);
    }

    cachedSettings = data;
    cachedSettingsAt = Date.now();
    return data;
  },

  /**
   * Send phone OTP via the active / enabled provider
   */
  sendOtp: async ({ phone, userId = null }) => {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    const settings = await phoneVerificationService.getSettings();

    if (settings.active_provider === 'disabled') {
      throw new Error('Mobile verification is currently disabled by administrator.');
    }

    // Rate limiting per number: 10 requests in 60 seconds, then blocked for 20 minutes
    checkSendLimit(cleanPhone);

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = settings.otp_expiry_minutes || 5;
    const otpExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    const otpHash = hashOtp(otp);

    // A number keeps one pending code at a time: older unused codes are removed instead of piling up row after row
    // (verified rows stay, they are the proof that the number was verified)
    await supabase.from('phone_verifications').delete().eq('phone', cleanPhone).eq('is_verified', false);

    // Save into database
    const { error: insertError } = await supabase
      .from('phone_verifications')
      .insert([
        {
          phone: cleanPhone,
          otp_hash: otpHash,
          otp_expiry: otpExpiry,
          attempts: 0,
          is_verified: false,
          provider: settings.active_provider,
        },
      ]);

    if (insertError) {
      console.error('[PhoneVerification] Error inserting verification record:', insertError);
      throw new Error('Failed to generate verification code. Please try again.');
    }

    // Deliver via WhatsApp if WhatsApp is the active provider or enabled
    let deliveryResult = null;
    if (settings.active_provider === 'whatsapp' || settings.whatsapp_enabled) {
      deliveryResult = await whatsappBotService.sendOtpMessage(cleanPhone, otp, expiryMinutes);
    }

    return {
      success: true,
      phone: cleanPhone,
      provider: settings.active_provider,
      expiresInMinutes: expiryMinutes,
      simulated: deliveryResult?.simulated || false,
      message: `Verification code sent to +91 ${cleanPhone} via WhatsApp.`,
    };
  },

  /**
   * Verify entered OTP against stored hash
   */
  verifyOtp: async ({ phone, otp, userId = null, saveToAccount = true }) => {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    if (!otp || String(otp).trim().length < 4) {
      throw new Error('Please enter a valid verification code.');
    }

    // Find the latest pending OTP for this phone
    const { data: record, error } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !record) {
      throw new Error('No pending verification code found. Please request a new code.');
    }

    // Check expiry
    if (new Date(record.otp_expiry).getTime() < Date.now()) {
      throw new Error('Verification code has expired. Please request a new code.');
    }

    // Check attempts lockout
    const settings = await phoneVerificationService.getSettings();
    const maxAttempts = settings.max_attempts || 5;

    if (record.attempts >= maxAttempts) {
      throw new Error('Too many invalid attempts. Please request a new verification code.');
    }

    // Compare hashes
    const enteredHash = hashOtp(otp);
    if (enteredHash !== record.otp_hash) {
      // Increment attempt counter
      await supabase
        .from('phone_verifications')
        .update({ attempts: record.attempts + 1 })
        .eq('id', record.id);

      const remaining = maxAttempts - (record.attempts + 1);
      throw new Error(`Incorrect verification code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Please request a new code.'}`);
    }

    // Mark as verified
    await supabase
      .from('phone_verifications')
      .update({
        is_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    // This row is now the proof for the number: older rows for it are no longer needed
    await supabase.from('phone_verifications').delete().eq('phone', cleanPhone).neq('id', record.id);

    // If a user is logged in, their account number is updated too (not when the number belongs to someone else, e.g. a gift recipient)
    if (userId && saveToAccount && (await canSaveAsAccountNumber(userId, cleanPhone))) {
      await supabase
        .from('users')
        .update({
          phone: cleanPhone,
          is_phone_verified: true,
          phone_verified_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    return {
      success: true,
      phone: cleanPhone,
      isVerified: true,
      message: 'Mobile number verified successfully!',
    };
  },

  /**
   * Verify and save phone verified through Firebase Phone Auth
   */
  verifyFirebasePhone: async ({ phone, idToken, userId, saveToAccount = true }) => {
    const cleanPhone = clean10DigitPhone(phone);
    if (!cleanPhone) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    try {
      await supabase.from('phone_verifications').insert([{
        phone: cleanPhone,
        otp_hash: 'firebase_verified',
        provider: 'firebase',
        is_verified: true,
        attempts: 0,
        otp_expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }]);
    } catch {
      // ignore unique collision or table variations
    }

    if (userId && saveToAccount && (await canSaveAsAccountNumber(userId, cleanPhone))) {
      await supabase
        .from('users')
        .update({
          phone: cleanPhone,
          is_phone_verified: true,
          phone_verified_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    return {
      success: true,
      phone: cleanPhone,
      isVerified: true,
      provider: 'firebase',
      message: 'Mobile number verified successfully via Firebase!',
    };
  },

  /** Is mobile verification switched on? (When it is off, no number has to be verified.) */
  isVerificationRequired: async () => {
    const settings = await phoneVerificationService.getSettings();
    return settings.active_provider !== 'disabled';
  },

  /**
   * Has this number been verified? True for the account's own verified number, or any number verified in the last 90 days.
   */
  isPhoneVerified: async ({ phone, userId = null }) => {
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length !== 10) return false;

    if (userId) {
      const { data: user } = await supabase.from('users').select('phone, is_phone_verified').eq('id', userId).maybeSingle();
      if (user?.is_phone_verified && normalizePhone(user.phone) === cleanPhone) return true;
    }

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('phone_verifications')
      .select('id')
      .eq('phone', cleanPhone)
      .eq('is_verified', true)
      .gte('created_at', since)
      .limit(1);
    return Boolean(data && data.length > 0);
  },
};

