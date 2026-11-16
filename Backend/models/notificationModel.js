import { supabase } from '../config/supabase.js';

export const notificationModel = {
  findByUserId: async (userId, limit = 50) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('buyer_id', userId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error finding notifications for user ${userId}:`, error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findByBuyerId: async (buyerId, limit = 50) => {
    return notificationModel.findByUserId(buyerId, limit);
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding notification:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  create: async (notificationData) => {
    const payload = {
      buyer_id: notificationData.buyer_id || notificationData.user_id || null,
      title: notificationData.title,
      message: notificationData.message || null,
      is_read: notificationData.is_read !== undefined ? notificationData.is_read : false
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  // Automatic notifications carry a unique identity (user + event + order, see migration 011). Returns null when this
  // exact notification already exists, so retries never create a duplicate and messages never mix between orders.
  createUnique: async (n) => {
    const payload = {
      buyer_id: n.buyer_id,
      title: n.title,
      message: n.message || null,
      type: n.type || 'system',
      event_key: n.event_key || null,
      order_id: n.order_id ? String(n.order_id) : null,
      link: n.link || null,
      data: n.data || {},
      is_read: false
    };

    const { data, error } = await supabase.from('notifications').insert([payload]).select().single();
    if (error) {
      if (error.code === '23505') return null; // already sent
      console.error('Error creating notification:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  // Bulk insert (admin broadcast). Returns the inserted rows.
  createMany: async (rows) => {
    const { data, error } = await supabase.from('notifications').insert(rows).select();
    if (error) {
      console.error('Error creating notifications:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  markAsRead: async (id) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error marking notification as read:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  // "Delete" from the customer's side: the row stays in the table, it just stops showing in their list
  hideForUser: async (id, buyerId) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_hidden: true, hidden_at: new Date().toISOString() })
      .eq('id', id)
      .eq('buyer_id', buyerId)
      .select('id');

    if (error) {
      console.error('Error hiding notification:', error.message);
      throw new Error(error.message);
    }
    return (data || []).length > 0;
  },

  markAllAsRead: async (buyerId) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('buyer_id', buyerId)
      .eq('is_read', false)
      .eq('is_hidden', false)
      .select();

    if (error) {
      console.error('Error marking all notifications as read:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting notification:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
