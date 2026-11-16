import { supabase } from '../config/supabase.js';

export const inventoryLogModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('inventory_logs')
      .select('*, products:product_id(id, name, stock)')
      .order('created_at', { ascending: false });

    if (filters.product_id) {
      query = query.eq('product_id', filters.product_id);
    }
    if (filters.change_type) {
      query = query.eq('change_type', filters.change_type);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching inventory logs:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('inventory_logs')
      .select('*, products:product_id(id, name, stock)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding inventory log:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByProductId: async (productId) => {
    const { data, error } = await supabase
      .from('inventory_logs')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching logs for product ${productId}:`, error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  create: async (logData) => {
    const payload = {
      product_id: logData.product_id,
      change_type: logData.change_type, // 'added', 'reduced', 'adjusted'
      quantity: logData.quantity,
      reason: logData.reason || null,
      created_by: logData.created_by || null
    };

    const { data, error } = await supabase
      .from('inventory_logs')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating inventory log:', error.message);
      throw new Error(error.message);
    }
    return data;
  }
};
