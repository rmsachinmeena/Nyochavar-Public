import { supabase } from '../config/supabase.js';

export const subscriberModel = {
  subscribe: async (email) => {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Email is required');
    }

    const { data, error } = await supabase
      .from('subscriberTable')
      .upsert(
        [
          {
            email: cleanEmail,
            is_active: true,
            created_at: new Date().toISOString()
          }
        ],
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error inserting into subscriberTable:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  getAll: async (limit = 50) => {
    const { data, error } = await supabase
      .from('subscriberTable')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching subscribers:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  }
};
