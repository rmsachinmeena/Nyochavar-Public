import { supabase } from '../config/supabase.js';

export const auditLogModel = {
  findAll: async () => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  findByAdminId: async (admin_id) => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('admin_id', admin_id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  create: async (logData) => {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert([logData])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
};