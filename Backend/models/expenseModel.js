import { supabase } from '../config/supabase.js';

export const expenseModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.added_by) {
      query = query.eq('added_by', filters.added_by);
    }
    if (filters.startDate) {
      query = query.gte('expense_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('expense_date', filters.endDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching expenses:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding expense:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (expenseData) => {
    const payload = {
      title: expenseData.title,
      category: expenseData.category || null,
      amount: expenseData.amount,
      expense_date: expenseData.expense_date || new Date().toISOString().split('T')[0],
      added_by: expenseData.added_by || expenseData.created_by || null
    };

    const { data, error } = await supabase
      .from('expenses')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating expense:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const payload = { ...updates };
    if (payload.created_by && !payload.added_by) {
      payload.added_by = payload.created_by;
      delete payload.created_by;
    }

    const { data, error } = await supabase
      .from('expenses')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating expense:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting expense:', error.message);
      throw new Error(error.message);
    }
    return true;
  },

  getSummary: async (startDate = null, endDate = null) => {
    let query = supabase.from('expenses').select('category, amount');

    if (startDate) query = query.gte('expense_date', startDate);
    if (endDate) query = query.lte('expense_date', endDate);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching expense summary:', error.message);
      throw new Error(error.message);
    }

    const summary = {};
    let grandTotal = 0;
    (data || []).forEach(item => {
      const amt = Number(item.amount) || 0;
      const cat = item.category || 'Uncategorized';
      summary[cat] = (summary[cat] || 0) + amt;
      grandTotal += amt;
    });

    return { summary, grandTotal };
  }
};
