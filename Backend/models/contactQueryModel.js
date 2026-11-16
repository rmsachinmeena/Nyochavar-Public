import { supabase } from '../config/supabase.js';

export const contactQueryModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('contact_queries')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.email) {
      query = query.eq('email', filters.email);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching contact queries:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('contact_queries')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding contact query:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (queryData) => {
    const payload = {
      name: queryData.name,
      email: queryData.email || null,
      phone: queryData.phone || null,
      message: queryData.message,
      status: queryData.status || 'open'
    };

    const { data, error } = await supabase
      .from('contact_queries')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating contact query:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  updateStatus: async (id, status) => {
    const validStatuses = ['open', 'in_progress', 'resolved'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of ${validStatuses.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('contact_queries')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating query status:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('contact_queries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating contact query:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('contact_queries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting contact query:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
