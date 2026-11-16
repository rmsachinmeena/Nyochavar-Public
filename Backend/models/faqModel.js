import { supabase } from '../config/supabase.js';

export const faqModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('faqs')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (typeof filters.is_active === 'boolean') {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching FAQs:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findActive: async () => {
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching active FAQs:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding FAQ:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (faqData) => {
    const payload = {
      question: faqData.question,
      answer: faqData.answer,
      display_order: faqData.display_order || 0,
      is_active: faqData.is_active !== undefined ? faqData.is_active : true
    };

    const { data, error } = await supabase
      .from('faqs')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating FAQ:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('faqs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating FAQ:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('faqs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting FAQ:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
