import { supabase } from '../config/supabase.js';

export const adminModel = {
  findAll: async (filters = {}) => {
    // Check super_admins first, fallback to admins
    let tableName = 'super_admins';
    let { data, error } = await supabase
      .from(tableName)
      .select('id, name, email, role, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error && error.code !== 'PGRST116') {
      tableName = 'admins';
      const fallback = await supabase
        .from(tableName)
        .select('id, name, email, role, is_active, created_at')
        .order('created_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('Error fetching admins:', error.message);
      return [];
    }
    return data || [];
  },

  findById: async (id) => {
    let { data, error } = await supabase
      .from('super_admins')
      .select('id, name, email, role, is_active, created_at')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      const fallback = await supabase
        .from('admins')
        .select('id, name, email, role, is_active, created_at')
        .eq('id', id)
        .single();
      data = fallback.data;
    }

    return data || null;
  },

  findByEmail: async (email) => {
    const cleanEmail = email?.trim().toLowerCase();
    // Try super_admins first
    let { data, error } = await supabase
      .from('super_admins')
      .select('*')
      .ilike('email', cleanEmail)
      .single();

    // If super_admins doesn't exist or not found, try admins table
    if (!data || (error && error.code !== 'PGRST116')) {
      const fallback = await supabase
        .from('admins')
        .select('*')
        .ilike('email', cleanEmail)
        .single();
      if (fallback.data) {
        data = fallback.data;
      }
    }

    return data || null;
  },

  create: async (adminData) => {
    const payload = {
      name: adminData.name,
      email: adminData.email?.trim().toLowerCase(),
      password: adminData.password, // Plain text as requested
      role: adminData.role || 'superadmin',
      is_active: adminData.is_active !== undefined ? adminData.is_active : true
    };

    const { data, error } = await supabase
      .from('admins')
      .insert([payload])
      .select('id, name, email, role, is_active, created_at')
      .single();

    if (error) {
      console.error('Error creating admin:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const payload = { ...updates };
    if (payload.password_hash && !payload.password) {
      payload.password = payload.password_hash;
      delete payload.password_hash;
    }

    const { data, error } = await supabase
      .from('admins')
      .update(payload)
      .eq('id', id)
      .select('id, name, email, role, is_active, created_at')
      .single();

    if (error) {
      console.error('Error updating admin:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  updatePassword: async (id, newPassword) => {
    const { data, error } = await supabase
      .from('admins')
      .update({ password: newPassword })
      .eq('id', id)
      .select('id, name, email, role, is_active')
      .single();

    if (error) {
      console.error('Error updating admin password:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('admins')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting admin:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
