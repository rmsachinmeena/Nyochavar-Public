import { supabase } from '../config/supabase.js';

// The wishlist lives in the `favorites` table (user_id, product_id, created_at) defined in migrations/001_init_schema.sql.
const TABLE = 'favorites';

export const wishlistModel = {
  findByBuyerId: async (buyerId) => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, products:product_id(*)')
      .eq('user_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error finding wishlist for buyer ${buyerId}:`, error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findByUserId: async (userId) => {
    return wishlistModel.findByBuyerId(userId);
  },

  // Adds one or many products. Products that no longer exist are skipped, and re-adding a saved one is a no-op.
  addMany: async (buyerId, productIds) => {
    const ids = [...new Set(productIds)];
    if (ids.length === 0) return [];

    const { data: existingProducts, error: lookupError } = await supabase.from('products').select('id').in('id', ids);
    if (lookupError) {
      console.error('Error checking wishlist products:', lookupError.message);
      throw new Error(lookupError.message);
    }

    const rows = (existingProducts || []).map((product) => ({ user_id: buyerId, product_id: product.id }));
    if (rows.length === 0) return [];

    const { data, error } = await supabase
      .from(TABLE)
      .upsert(rows, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error('Error adding to wishlist:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  add: async (buyerId, productId) => {
    const added = await wishlistModel.addMany(buyerId, [productId]);
    return added[0] || { user_id: buyerId, product_id: productId };
  },

  remove: async (buyerId, productId) => {
    const { error } = await supabase.from(TABLE).delete().eq('user_id', buyerId).eq('product_id', productId);

    if (error) {
      console.error('Error removing from wishlist:', error.message);
      throw new Error(error.message);
    }
    return true;
  },

  toggle: async (buyerId, productId) => {
    const { data: existing } = await supabase
      .from(TABLE)
      .select('product_id')
      .eq('user_id', buyerId)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing) {
      await wishlistModel.remove(buyerId, productId);
      return { added: false, productId };
    }
    const added = await wishlistModel.add(buyerId, productId);
    return { added: true, item: added };
  }
};
