import { supabase } from '../config/supabase.js';

export const customizationModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('customizations')
      .select('*, orders:order_id(id, total_amount, order_status)')
      .order('created_at', { ascending: false });

    if (filters.buyer_id) {
      query = query.eq('buyer_id', filters.buyer_id);
    }
    if (filters.order_id) {
      query = query.eq('order_id', filters.order_id);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching customizations:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('customizations')
      .select('*, orders:order_id(id, total_amount, order_status)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding customization:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByBuyerId: async (buyerId) => {
    const { data, error } = await supabase
      .from('customizations')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error finding customizations for buyer ${buyerId}:`, error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  create: async (data) => {
    const payload = {
      buyer_id: data.buyer_id || data.user_id || null,
      order_id: data.order_id || null,
      occasion: data.occasion || null,
      uploaded_photo: data.uploaded_photo || data.custom_photo_url || null,
      relationship_note: data.relationship_note || data.sentiment_note || null,
      selected_theme: data.selected_theme || data.theme_palette || null,
      budget_range: data.budget_range ? String(data.budget_range) : null,
      status: data.status || 'submitted'
    };

    const { data: created, error } = await supabase
      .from('customizations')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating customization:', error.message);
      throw new Error(error.message);
    }
    return created;
  },

  updateStatus: async (id, status) => {
    const valid = ['submitted', 'reviewed', 'in_progress'];
    if (!valid.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of ${valid.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('customizations')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customization status:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('customizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customization:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('customizations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting customization:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
