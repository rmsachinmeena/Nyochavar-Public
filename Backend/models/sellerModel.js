import { supabase } from '../config/supabase.js';

// Safe formatter: never expose password or reset OTP hashes outside the auth service
export const formatSeller = (seller) => {
  if (!seller) return null;
  const { password_hash, reset_otp_hash, reset_otp_expires_at, ...safe } = seller;
  return {
    ...safe,
    bank_details: safe.bank_details || {},
  };
};

// Normalize 10-digit Indian mobile number
export const normalizePhone = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  return digits.slice(-10);
};

export const sellerModel = {
  /**
   * Find a seller for authentication purposes (includes password_hash).
   * Checks both email address and 10-digit mobile number.
   */
  findAuthByIdentifier: async (identifier) => {
    if (!identifier) return null;
    const clean = String(identifier).trim();
    const isEmail = clean.includes('@');

    if (isEmail) {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .ilike('email', clean.toLowerCase())
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error finding seller by email:', error.message);
      }
      return data || null;
    }

    const phone = normalizePhone(clean);
    if (!phone) return null;

    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding seller by phone:', error.message);
    }
    return data || null;
  },

  /** Find seller by email */
  findByEmail: async (email) => {
    if (!email) return null;
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .ilike('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding seller by email:', error.message);
    }
    return data ? formatSeller(data) : null;
  },

  /** Find seller by phone */
  findByPhone: async (phone) => {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return null;

    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding seller by phone:', error.message);
    }
    return data ? formatSeller(data) : null;
  },

  /** Find seller by primary UUID */
  findById: async (id) => {
    if (!id) return null;
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding seller by id:', error.message);
    }
    return data ? formatSeller(data) : null;
  },

  /**
   * Register and create a new seller record.
   */
  create: async (sellerData) => {
    const payload = {
      store_name: sellerData.store_name?.trim(),
      owner_name: sellerData.owner_name?.trim() || sellerData.store_name?.trim(),
      email: sellerData.email?.trim().toLowerCase(),
      phone: normalizePhone(sellerData.phone),
      password_hash: sellerData.password_hash,
      category: sellerData.category || 'Gourmet Hampers & Sweets',
      pincode: sellerData.pincode?.trim() || null,
      street_address: sellerData.street_address?.trim() || null,
      city: sellerData.city?.trim() || 'Jaipur',
      pickup_slot: sellerData.pickup_slot || 'Morning (10:00 AM - 01:00 PM)',
      payout_method: sellerData.payout_method || 'upi',
      upi_id: sellerData.upi_id?.trim() || null,
      bank_details: sellerData.bank_details || {},
      status: sellerData.status || 'active',
      is_active: sellerData.is_active !== undefined ? sellerData.is_active : true,
      is_vacation_mode: sellerData.is_vacation_mode || false,
      kyc_status: sellerData.kyc_status || 'verified',
    };

    const { data, error } = await supabase
      .from('sellers')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error inserting seller:', error.message);
      throw new Error(error.message);
    }
    return formatSeller(data);
  },

  /** Update profile fields */
  update: async (id, updates) => {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    delete payload.password_hash;
    delete payload.reset_otp_hash;
    delete payload.id;

    if (payload.email) payload.email = payload.email.trim().toLowerCase();
    if (payload.phone) payload.phone = normalizePhone(payload.phone);

    const { data, error } = await supabase
      .from('sellers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating seller:', error.message);
      throw new Error(error.message);
    }
    return formatSeller(data);
  },

  /** Update password */
  updatePassword: async (id, passwordHash) => {
    const { data, error } = await supabase
      .from('sellers')
      .update({
        password_hash: passwordHash,
        reset_otp_hash: null,
        reset_otp_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating seller password:', error.message);
      throw new Error(error.message);
    }
    return formatSeller(data);
  },

  /** Store OTP hash for password reset (a new code starts with zero wrong tries) */
  saveResetOtp: async (id, { otpHash, expiresAt }) => {
    const base = {
      reset_otp_hash: otpHash,
      reset_otp_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabase.from('sellers').update({ ...base, reset_attempts: 0 }).eq('id', id);

    // Migration 028 not run yet: the attempts column is missing, so save the code without it
    if (error && error.code === '42703') {
      ({ error } = await supabase.from('sellers').update(base).eq('id', id));
    }

    if (error) {
      console.error('Error saving seller reset OTP:', error.message);
      throw new Error(error.message);
    }
  },

  /** One more wrong reset code (the code stops working after too many) */
  bumpResetAttempts: async (id, attempts) => {
    const { error } = await supabase.from('sellers').update({ reset_attempts: attempts }).eq('id', id);
    if (error && error.code !== '42703') console.error('Error counting seller reset attempt:', error.message);
  },

  /** Throws away a reset code that is used up */
  clearResetOtp: async (id) => {
    const { error } = await supabase
      .from('sellers')
      .update({ reset_otp_hash: null, reset_otp_expires_at: null })
      .eq('id', id);
    if (error) console.error('Error clearing seller reset OTP:', error.message);
  },
};
