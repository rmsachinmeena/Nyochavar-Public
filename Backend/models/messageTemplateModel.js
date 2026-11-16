import { supabase } from '../config/supabase.js';

export const messageTemplateModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (typeof filters.is_active === 'boolean') {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching message templates:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding message template:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (templateData) => {
    const payload = {
      name: templateData.name,
      type: templateData.type || 'email',
      subject: templateData.subject || null,
      content: templateData.content,
      variables: templateData.variables || [],
      is_active: templateData.is_active !== undefined ? templateData.is_active : true
    };

    const { data, error } = await supabase
      .from('message_templates')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating message template:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('message_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating message template:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting message template:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
