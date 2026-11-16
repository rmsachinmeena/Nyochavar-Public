import { supabase } from '../config/supabase.js';

export const reviewModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('reviews')
      .select('*, products:product_id(id, name, base_price), orders:order_id(id, order_status)')
      .order('created_at', { ascending: false });

    if (filters.product_id) {
      query = query.eq('product_id', filters.product_id);
    }
    if (filters.buyer_id) {
      query = query.eq('buyer_id', filters.buyer_id);
    }
    if (filters.order_id) {
      query = query.eq('order_id', filters.order_id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching reviews:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, products:product_id(id, name, base_price), orders:order_id(id, order_status)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding review:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByProductId: async (productId) => {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error finding reviews for product ${productId}:`, error.message);
      throw new Error(error.message);
    }
    
    if (!reviews || reviews.length === 0) return [];

    const buyerIds = [...new Set(reviews.filter(r => r.buyer_id).map(r => r.buyer_id))];
    if (buyerIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', buyerIds);
        
      if (!usersError && usersData) {
        const usersMap = {};
        usersData.forEach(u => usersMap[u.id] = u);
        reviews.forEach(r => {
          if (r.buyer_id && usersMap[r.buyer_id]) {
            r.users = usersMap[r.buyer_id];
          }
        });
      }
    }

    return reviews;
  },

  create: async (reviewData) => {
    const payload = {
      buyer_id: reviewData.buyer_id || reviewData.user_id || null,
      product_id: reviewData.product_id,
      order_id: reviewData.order_id || null,
      rating: reviewData.rating,
      comment: reviewData.comment || null,
      images: reviewData.images || []
    };

    const { data, error } = await supabase
      .from('reviews')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating review:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  // Reviews a buyer already left for these orders (to know which products are still waiting for one)
  findForOrders: async (buyerId, orderIds) => {
    if (!orderIds || orderIds.length === 0) return [];
    const { data, error } = await supabase
      .from('reviews')
      .select('order_id, product_id')
      .eq('buyer_id', buyerId)
      .in('order_id', orderIds);

    if (error) throw new Error(error.message);
    return data || [];
  },

  createMany: async (rows) => {
    const { data, error } = await supabase.from('reviews').insert(rows).select();
    if (error) {
      if (error.code === '23505') return null; // already reviewed
      console.error('Error creating reviews:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  // Keeps products.rating / review_count equal to the average of its reviews
  refreshProductRating: async (productId) => {
    const { data, error } = await supabase.from('reviews').select('rating').eq('product_id', productId);
    if (error) throw new Error(error.message);
    const ratings = (data || []).map((row) => Number(row.rating)).filter((n) => Number.isFinite(n));
    const average = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
    const { error: updateError } = await supabase.from('products').update({ rating: average, review_count: ratings.length }).eq('id', productId);
    if (updateError) throw new Error(updateError.message);
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating review:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting review:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
