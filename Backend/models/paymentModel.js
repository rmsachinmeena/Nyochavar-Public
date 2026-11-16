import { supabase } from '../config/supabase.js';

export const paymentModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }
    if (filters.order_id) {
      query = query.eq('order_id', filters.order_id);
    }
    if (filters.payment_method) {
      query = query.eq('payment_method', filters.payment_method);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching payments:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding payment:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByOrderId: async (orderId) => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error finding payments for order ${orderId}:`, error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findByTransactionRef: async (transactionRef) => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_ref', transactionRef)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding payment by transaction ref:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (paymentData) => {
    const payload = {
      order_id: paymentData.order_id || null,
      amount: paymentData.amount,
      payment_method: paymentData.payment_method || null,
      payment_status: paymentData.payment_status || 'pending',
      transaction_ref: paymentData.transaction_ref || paymentData.transaction_id || null
    };

    const { data, error } = await supabase
      .from('payments')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating payment record:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  updateStatus: async (id, paymentStatus, transactionRef = null) => {
    const payload = { payment_status: paymentStatus };
    if (transactionRef) payload.transaction_ref = transactionRef;

    const { data, error } = await supabase
      .from('payments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment status:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const payload = { ...updates };
    if (payload.transaction_id && !payload.transaction_ref) {
      payload.transaction_ref = payload.transaction_id;
      delete payload.transaction_id;
    }

    const { data, error } = await supabase
      .from('payments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment:', error.message);
      throw new Error(error.message);
    }
    return data;
  }
};
