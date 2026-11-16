import { supabase } from '../config/supabase.js';

export const bannerModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('banners')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (typeof filters.is_active === 'boolean') {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching banners:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findActive: async () => {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching active banners:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding banner:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (bannerData) => {
    const payload = {
      title: bannerData.title || null,
      image_url: bannerData.image_url,
      mobile_image_url: bannerData.mobile_image_url || null,
      subtitle: bannerData.subtitle || null,
      cta_text: bannerData.cta_text || null,
      badge: bannerData.badge || null,
      occasion: bannerData.occasion || null,
      show_overlay: Boolean(bannerData.show_overlay),
      link_url: bannerData.link_url || bannerData.target_url || null,
      is_active: bannerData.is_active !== undefined ? bannerData.is_active : true,
      display_order: bannerData.display_order || 0
    };

    const { data, error } = await supabase
      .from('banners')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating banner:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const payload = { ...updates };
    if (payload.target_url && !payload.link_url) {
      payload.link_url = payload.target_url;
      delete payload.target_url;
    }

    const { data, error } = await supabase
      .from('banners')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating banner:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('banners')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting banner:', error.message);
      throw new Error(error.message);
    }
    return true;
  },

  // Delete many banners in one statement. Returns the deleted ids.
  deleteMany: async (ids) => {
    const { data, error } = await supabase
      .from('banners')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('Error deleting banners:', error.message);
      throw new Error(error.message);
    }
    return (data || []).map((row) => row.id);
  }
};
