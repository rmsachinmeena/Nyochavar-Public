import { supabase } from '../config/supabase.js';

export const reminderModel = {
  findByBuyerId: async (buyerId) => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('reminder_date', { ascending: true });

    if (error) {
      console.error(`Error finding reminders for buyer ${buyerId}:`, error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding reminder:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findDueReminders: async (targetDate = new Date().toISOString().split('T')[0]) => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .lte('reminder_date', targetDate)
      .eq('is_notified', false);

    if (error) {
      console.error('Error fetching due reminders:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  create: async (reminderData) => {
    const payload = {
      buyer_id: reminderData.buyer_id || reminderData.user_id || null,
      occasion_name: reminderData.occasion_name,
      person_name: reminderData.person_name || null,
      reminder_date: reminderData.reminder_date,
      is_recurring_yearly: reminderData.is_recurring_yearly !== undefined ? reminderData.is_recurring_yearly : true,
      is_notified: reminderData.is_notified !== undefined ? reminderData.is_notified : false
    };

    const { data, error } = await supabase
      .from('reminders')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating reminder:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('reminders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating reminder:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  markNotified: async (id) => {
    const { data, error } = await supabase
      .from('reminders')
      .update({ is_notified: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error marking reminder as notified:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting reminder:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
