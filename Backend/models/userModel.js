import { supabase } from '../config/supabase.js';

export const userModel = {
  // Find all users (admin support)
  findAll: async (filters = {}) => {
    let query = supabase
      .from('users')
      .select('id, name, email, is_verified, is_phone_verified, phone, role, address_line, city, pincode, created_at')
      .order('created_at', { ascending: false });

    if (filters.role) {
      query = query.eq('role', filters.role);
    }
    if (typeof filters.is_verified === 'boolean') {
      query = query.eq('is_verified', filters.is_verified);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching users:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  // Find a user by their id
  findById: async (id) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, is_verified, is_phone_verified, phone, role, address_line, city, pincode, created_at')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding user by id:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  // Find a user by their email (includes password_hash and OTP for authentication)
  findByEmail: async (email) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error finding user:', error.message);
      throw new Error(error.message);
    }
    
    return data || null;
  },

  // Create a new unverified user
  createUser: async (userData) => {
    const { name, email, password_hash, otp_code, otp_expiry, phone, role, address_line, city, pincode } = userData;
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          name,
          email,
          password_hash,
          is_verified: userData.is_verified === true,
          otp_code: otp_code || null,
          otp_expiry: otp_expiry || null,
          phone: phone || null,
          role: role || 'buyer',
          address_line: address_line || null,
          city: city || null,
          pincode: pincode || null
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error.message);
      throw new Error(error.message);
    }

    return data;
  },

  // Create OAuth user (Google Sign-In)
  createOAuthUser: async (userData) => {
    const { name, email, password_hash, role, is_verified, otp_code, otp_expiry, google_id, auth_provider } = userData;
    const insertData = {
      name: name || email.split('@')[0],
      email,
      password_hash,
      google_id: google_id || null,
      auth_provider: auth_provider || 'email',
      is_verified: is_verified !== undefined ? is_verified : false,
      otp_code: otp_code || null,
      otp_expiry: otp_expiry || null,
      role: role || 'buyer',
      created_at: new Date().toISOString()
    };

    if (userData.id && !userData.id.startsWith('user_')) {
      insertData.id = userData.id;
    }

    const { data, error } = await supabase
      .from('users')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Error creating OAuth user:', error.message);
      return { data: null, error };
    }

    return { data, error: null };
  },

  // Attach a Google account to an existing user and mark the email as verified (Google proved ownership)
  linkGoogleAccount: async (userId, googleId) => {
    const { data, error } = await supabase
      .from('users')
      .update({ google_id: googleId, is_verified: true, otp_code: null, otp_expiry: null })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error linking Google account:', error.message);
      throw new Error(error.message);
    }

    return data;
  },

  // Update a user's OTP code (e.g. for resend)
  updateOTP: async (userId, otp_code, otp_expiry) => {
    const { data, error } = await supabase
      .from('users')
      .update({ otp_code, otp_expiry })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating OTP:', error.message);
      throw new Error(error.message);
    }

    return data;
  },

  // Mark a user as verified
  verifyUser: async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .update({ is_verified: true, otp_code: null, otp_expiry: null })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error verifying user:', error.message);
      throw new Error(error.message);
    }

    return data;
  },

  // Update profile fields
  updateProfile: async (userId, updates) => {
    const allowed = ['name', 'phone', 'email', 'address_line', 'city', 'pincode'];
    const payload = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) payload[key] = updates[key];
    }

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select('id, name, email, is_verified, phone, role, address_line, city, pincode')
      .single();

    if (error) {
      console.error('Error updating profile:', error.message);
      throw new Error(error.message);
    }

    return data;
  },

  // Update a user's password
  updatePassword: async (userId, password_hash) => {
    const { data, error } = await supabase
      .from('users')
      .update({ password_hash, auth_provider: 'email', otp_code: null, otp_expiry: null })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating password:', error.message);
      throw new Error(error.message);
    }

    return data;
  },

  // Complete user signup (set name, password, mark verified)
  completeSignup: async (userId, { name, password_hash }) => {
    const updateData = {
      name,
      is_verified: true,
      otp_code: null,
      otp_expiry: null
    };
    if (password_hash) {
      updateData.password_hash = password_hash;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, name, email, is_verified, is_phone_verified, phone, role, address_line, city, pincode, created_at')
      .single();

    if (error) {
      console.error('Error completing user signup:', error.message);
      throw new Error(error.message);
    }

    return data;
  },

  // Delete many customer accounts. Their tracked activity goes first (user_events references users).
  // Orders are kept for the sales records. Returns the deleted ids.
  deleteMany: async (ids) => {
    const { error: eventsError } = await supabase.from('user_events').delete().in('user_id', ids);
    if (eventsError) {
      console.error('Error deleting customer activity:', eventsError.message);
      throw new Error(eventsError.message);
    }

    const { data, error } = await supabase
      .from('users')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('Error deleting users:', error.message);
      throw new Error(error.message);
    }
    return (data || []).map((row) => row.id);
  }
};
