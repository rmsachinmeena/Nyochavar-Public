import { supabase } from '../config/supabase.js';

export const vendorModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('vendors')
      .select('*')
      .order('created_at', { ascending: false });

    if (typeof filters.is_active === 'boolean') {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.city) {
      query = query.eq('city', filters.city);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching vendors:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding vendor:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (vendorData) => {
    const payload = {
      shop_name: vendorData.shop_name || vendorData.name,
      owner_name: vendorData.owner_name || null,
      phone: vendorData.phone || null,
      city: vendorData.city || null,
      address: vendorData.address || null,
      is_active: vendorData.is_active !== undefined ? vendorData.is_active : true
    };

    const { data, error } = await supabase
      .from('vendors')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating vendor:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const payload = { ...updates };
    if (payload.name && !payload.shop_name) {
      payload.shop_name = payload.name;
      delete payload.name;
    }

    const { data, error } = await supabase
      .from('vendors')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating vendor:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting vendor:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
