import { supabase } from '../config/supabase.js';

export const cityModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('cities')
      .select('*')
      .order('city_name', { ascending: true });

    if (typeof filters.is_active === 'boolean') {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.state) {
      query = query.eq('state', filters.state);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching cities:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding city:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByName: async (cityName) => {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .ilike('city_name', cityName)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error finding city ${cityName}:`, error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (cityData) => {
    const payload = {
      city_name: cityData.city_name || cityData.name,
      state: cityData.state || null,
      is_active: cityData.is_active !== undefined ? cityData.is_active : true
    };

    const { data, error } = await supabase
      .from('cities')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating city:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const payload = { ...updates };
    if (payload.name && !payload.city_name) {
      payload.city_name = payload.name;
      delete payload.name;
    }

    const { data, error } = await supabase
      .from('cities')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating city:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('cities')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting city:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
