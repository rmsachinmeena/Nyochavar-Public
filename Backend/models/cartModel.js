import { supabase } from '../config/supabase.js';

export const cartModel = {
  findByBuyerId: async (buyerId) => {
    const { data, error } = await supabase
      .from('carts')
      .select('*')
      .eq('buyer_id', buyerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error finding cart for buyer ${buyerId}:`, error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByUserId: async (userId) => {
    return cartModel.findByBuyerId(userId);
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('carts')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding cart:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  saveCart: async (buyerId, items = []) => {
    const payload = {
      buyer_id: buyerId,
      items: items,
      updated_at: new Date().toISOString()
    };

    // Try finding existing cart first
    const existing = await cartModel.findByBuyerId(buyerId);
    if (existing) {
      const { data, error } = await supabase
        .from('carts')
        .update({ items, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating cart:', error.message);
        throw new Error(error.message);
      }
      return data;
    } else {
      const { data, error } = await supabase
        .from('carts')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('Error creating cart:', error.message);
        throw new Error(error.message);
      }
      return data;
    }
  },

  clearCart: async (buyerId) => {
    const { data, error } = await supabase
      .from('carts')
      .update({ items: [], updated_at: new Date().toISOString() })
      .eq('buyer_id', buyerId)
      .select()
      .single();

    if (error) {
      console.error('Error clearing cart:', error.message);
      throw new Error(error.message);
    }
    return data;
  }
};
