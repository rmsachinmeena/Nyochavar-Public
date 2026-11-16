import { supabase } from '../config/supabase.js';

// Whitelist of valid physical columns on public.products in Supabase
const VALID_PRODUCT_COLUMNS = new Set([
  'id',
  'name',
  'description',
  'base_price',
  'category_id',
  'images',
  'is_customizable',
  'stock',
  'is_active',
  'created_at',
  'is_trending',
  'has_gift_wrap',
  'express_delivery_available',
  'review_snippet',
  'is_eco_friendly',
  'is_top_rated_this_week',
  'is_personalization_available',
  'loyalty_points_value',
  'is_bestseller',
  'tagline',
  'mrp',
  'occasions',
  'rating',
  'review_count',
  'badges',
  'delivery_charge',
  'is_free_delivery',
  'coupon_code',
  'min_order_amount',
  'max_discount',
  'delivery_time_text',
  'variants'
]);

const NEW_EXTENDED_COLUMNS = new Set([
  'tagline',
  'mrp',
  'occasions',
  'rating',
  'review_count',
  'badges',
  'delivery_charge',
  'is_free_delivery',
  'coupon_code',
  'min_order_amount',
  'max_discount',
  'delivery_time_text'
]);

export const ALLOWED_BADGES = new Set(['new', 'bestseller', 'trending', 'top_rated', 'eco', 'budget']);

export function processBadges(badgesInput, oldFlags = {}) {
  let badgeList = [];
  if (Array.isArray(badgesInput)) {
    badgeList = badgesInput;
  } else if (typeof badgesInput === 'string' && badgesInput.trim()) {
    badgeList = badgesInput.split(',').map((s) => s.trim());
  }

  const badgeSet = new Set();
  for (const b of badgeList) {
    const clean = String(b).trim().toLowerCase();
    if (ALLOWED_BADGES.has(clean)) {
      badgeSet.add(clean);
    }
  }

  // Sync from legacy boolean flags if active
  if (oldFlags.is_bestseller) badgeSet.add('bestseller');
  if (oldFlags.is_trending) badgeSet.add('trending');
  if (oldFlags.is_top_rated_this_week) badgeSet.add('top_rated');
  if (oldFlags.is_eco_friendly) badgeSet.add('eco');

  const finalBadges = Array.from(badgeSet);
  return {
    badges: finalBadges,
    is_bestseller: finalBadges.includes('bestseller'),
    is_trending: finalBadges.includes('trending'),
    is_top_rated_this_week: finalBadges.includes('top_rated'),
    is_eco_friendly: finalBadges.includes('eco')
  };
}

export function processRating(rating) {
  if (rating === undefined || rating === null || rating === '') return 0;
  const num = Number(rating);
  if (isNaN(num)) return 0;
  return Math.min(5, Math.max(0, Math.round(num * 10) / 10));
}

export function processReviewCount(count) {
  if (count === undefined || count === null || count === '') return 0;
  const num = parseInt(count, 10);
  if (isNaN(num)) return 0;
  return Math.max(0, num);
}

export function processOccasions(occasions) {
  if (!occasions) return [];
  const list = Array.isArray(occasions) ? occasions : [occasions];
  const result = [];
  for (const item of list) {
    if (typeof item === 'string' && item.trim()) {
      const clean = item.trim();
      if (!result.includes(clean)) result.push(clean);
    }
  }
  return result;
}

function sanitizeProductPayload(payload) {
  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (VALID_PRODUCT_COLUMNS.has(key) && value !== undefined) {
      if (key === 'occasions') {
        clean[key] = processOccasions(value);
      } else if (key === 'badges') {
        clean[key] = Array.isArray(value) ? value : [];
      } else if (key === 'rating') {
        clean[key] = processRating(value);
      } else if (key === 'review_count') {
        clean[key] = processReviewCount(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

export function attachReviewStats(product) {
  if (!product) return product;
  const reviews = product.reviews;
  if (Array.isArray(reviews) && reviews.length > 0) {
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    const avg = Math.round((sum / total) * 10) / 10;
    product.review_count = total;
    product.reviewCount = total;
    product.rating = avg;
  } else {
    product.review_count = Number(product.review_count) || 0;
    product.reviewCount = product.review_count;
    product.rating = Number(product.rating) || 0;
  }
  return product;
}

export const productModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('products')
      .select('*, categories:category_id(id, name, slug), reviews(rating)')
      .order('created_at', { ascending: false });

    if (typeof filters.is_active === 'boolean') {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }
    if (typeof filters.is_customizable === 'boolean') {
      query = query.eq('is_customizable', filters.is_customizable);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching products:', error.message);
      throw new Error(error.message);
    }
    return (data || []).map(attachReviewStats);
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories:category_id(id, name, slug), reviews(rating)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding product:', error.message);
      throw new Error(error.message);
    }
    return attachReviewStats(data);
  },

  create: async (productData) => {
    let category_id = productData.category_id || null;

    // Verify category_id exists in database to prevent foreign key constraint violations
    if (category_id) {
      const { data: catExists } = await supabase
        .from('categories')
        .select('id')
        .eq('id', category_id)
        .maybeSingle();

      if (!catExists?.id) {
        // Fallback: check if category name matches a valid category in DB
        if (productData.category) {
          const { data: catByName } = await supabase
            .from('categories')
            .select('id')
            .ilike('name', productData.category.trim())
            .limit(1)
            .maybeSingle();
          category_id = catByName?.id || null;
        } else {
          category_id = null;
        }
      }
    } else if (productData.category) {
      const { data: catByName } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', productData.category.trim())
        .limit(1)
        .maybeSingle();
      category_id = catByName?.id || null;
    }

    const badgeResult = processBadges(productData.badges, {
      is_bestseller: productData.is_bestseller || productData.isBestSeller || productData.is_best_seller,
      is_trending: productData.is_trending,
      is_top_rated_this_week: productData.is_top_rated_this_week,
      is_eco_friendly: productData.is_eco_friendly
    });
    if (productData.is_new !== undefined ? productData.is_new : productData.isNew) {
      if (!badgeResult.badges.includes('new')) badgeResult.badges.push('new');
    }
    if (productData.is_budget_friendly) {
      if (!badgeResult.badges.includes('budget')) badgeResult.badges.push('budget');
    }

    const rawPayload = {
      name: productData.name,
      tagline: productData.tagline ? String(productData.tagline).trim() : '',
      description: productData.description || null,
      base_price: productData.base_price !== undefined ? productData.base_price : productData.price,
      mrp: productData.mrp !== undefined && productData.mrp !== '' && productData.mrp !== null ? Number(productData.mrp) : null,
      category_id,
      images: productData.images || (productData.image ? [productData.image] : []),
      occasions: processOccasions(productData.occasions),
      rating: processRating(productData.rating),
      review_count: processReviewCount(productData.review_count !== undefined ? productData.review_count : productData.reviewCount),
      badges: badgeResult.badges,
      is_customizable: productData.is_customizable !== undefined ? productData.is_customizable : false,
      is_trending: badgeResult.is_trending,
      has_gift_wrap: Boolean(productData.has_gift_wrap),
      express_delivery_available: Boolean(productData.express_delivery_available),
      review_snippet: productData.review_snippet ? String(productData.review_snippet).trim() : null,
      is_eco_friendly: badgeResult.is_eco_friendly,
      is_top_rated_this_week: badgeResult.is_top_rated_this_week,
      is_personalization_available: Boolean(productData.is_personalization_available),
      is_bestseller: badgeResult.is_bestseller,
      loyalty_points_value: Number(productData.loyalty_points_value) || 0,
      stock: productData.stock !== undefined ? productData.stock : 0,
      is_active: productData.is_active !== undefined ? productData.is_active : true,
      delivery_charge: productData.delivery_charge !== undefined && productData.delivery_charge !== '' ? Number(productData.delivery_charge) : null,
      is_free_delivery: Boolean(productData.is_free_delivery),
      coupon_code: productData.coupon_code ? String(productData.coupon_code).trim().toUpperCase() : null,
      min_order_amount: productData.min_order_amount !== undefined && productData.min_order_amount !== '' ? Number(productData.min_order_amount) : null,
      max_discount: productData.max_discount !== undefined && productData.max_discount !== '' ? Number(productData.max_discount) : null,
      delivery_time_text: productData.delivery_time_text ? String(productData.delivery_time_text).trim() : null,
      variants: productData.variants || []
    };

    let payload = sanitizeProductPayload(rawPayload);

    let { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .single();

    // Graceful fallback if extended columns have not been migrated in SQL yet
    if (error && error.code === '42703') {
      const fallbackPayload = {};
      for (const [k, v] of Object.entries(payload)) {
        if (!NEW_EXTENDED_COLUMNS.has(k)) fallbackPayload[k] = v;
      }
      const retry = await supabase.from('products').insert([fallbackPayload]).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error creating product:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const rawPayload = {};

    if (updates.name !== undefined) rawPayload.name = updates.name;
    if (updates.description !== undefined) rawPayload.description = updates.description;
    if (updates.base_price !== undefined) {
      rawPayload.base_price = updates.base_price;
    } else if (updates.price !== undefined) {
      rawPayload.base_price = updates.price;
    }

    // Resolve category_id and ignore raw category/categories string
    if (updates.category_id !== undefined) {
      rawPayload.category_id = updates.category_id;
    } else if (updates.category) {
      const { data: catByName } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', String(updates.category).trim())
        .limit(1)
        .maybeSingle();
      if (catByName?.id) {
        rawPayload.category_id = catByName.id;
      }
    }

    if (updates.images !== undefined) {
      rawPayload.images = Array.isArray(updates.images) ? updates.images : [updates.images];
    } else if (updates.gallery !== undefined) {
      rawPayload.images = Array.isArray(updates.gallery) ? updates.gallery : [updates.gallery];
    } else if (updates.image !== undefined) {
      rawPayload.images = [updates.image];
    }

    if (updates.stock !== undefined) rawPayload.stock = updates.stock;
    if (updates.is_customizable !== undefined) rawPayload.is_customizable = updates.is_customizable;
    if (updates.tagline !== undefined) rawPayload.tagline = updates.tagline ? String(updates.tagline).trim() : '';
    if (updates.mrp !== undefined) rawPayload.mrp = updates.mrp === '' || updates.mrp === null ? null : Number(updates.mrp);
    if (updates.occasions !== undefined) rawPayload.occasions = processOccasions(updates.occasions);
    if (updates.rating !== undefined) rawPayload.rating = processRating(updates.rating);
    if (updates.review_count !== undefined) rawPayload.review_count = processReviewCount(updates.review_count);
    if (updates.reviewCount !== undefined && updates.review_count === undefined) rawPayload.review_count = processReviewCount(updates.reviewCount);

    if (
      updates.badges !== undefined ||
      updates.is_bestseller !== undefined ||
      updates.is_best_seller !== undefined ||
      updates.isBestSeller !== undefined ||
      updates.is_trending !== undefined ||
      updates.is_top_rated_this_week !== undefined ||
      updates.is_eco_friendly !== undefined ||
      updates.is_new !== undefined ||
      updates.isNew !== undefined ||
      updates.is_budget_friendly !== undefined
    ) {
      const badgeResult = processBadges(updates.badges !== undefined ? updates.badges : [], {
        is_bestseller: updates.is_bestseller || updates.is_best_seller || updates.isBestSeller,
        is_trending: updates.is_trending,
        is_top_rated_this_week: updates.is_top_rated_this_week,
        is_eco_friendly: updates.is_eco_friendly
      });
      if (updates.is_new !== undefined ? updates.is_new : updates.isNew) {
        if (!badgeResult.badges.includes('new')) badgeResult.badges.push('new');
      }
      if (updates.is_budget_friendly) {
        if (!badgeResult.badges.includes('budget')) badgeResult.badges.push('budget');
      }
      if (updates.badges !== undefined) {
        rawPayload.badges = badgeResult.badges;
      }
      rawPayload.is_bestseller = badgeResult.is_bestseller;
      rawPayload.is_trending = badgeResult.is_trending;
      rawPayload.is_top_rated_this_week = badgeResult.is_top_rated_this_week;
      rawPayload.is_eco_friendly = badgeResult.is_eco_friendly;
    }

    if (updates.has_gift_wrap !== undefined) rawPayload.has_gift_wrap = Boolean(updates.has_gift_wrap);
    if (updates.express_delivery_available !== undefined) rawPayload.express_delivery_available = Boolean(updates.express_delivery_available);
    if (updates.review_snippet !== undefined) rawPayload.review_snippet = updates.review_snippet ? String(updates.review_snippet).trim() : null;
    if (updates.is_personalization_available !== undefined) rawPayload.is_personalization_available = Boolean(updates.is_personalization_available);
    if (updates.loyalty_points_value !== undefined) rawPayload.loyalty_points_value = Number(updates.loyalty_points_value) || 0;
    if (updates.is_active !== undefined) rawPayload.is_active = updates.is_active;
    if (updates.delivery_charge !== undefined) rawPayload.delivery_charge = updates.delivery_charge === '' ? null : Number(updates.delivery_charge);
    if (updates.is_free_delivery !== undefined) rawPayload.is_free_delivery = Boolean(updates.is_free_delivery);
    if (updates.coupon_code !== undefined) rawPayload.coupon_code = updates.coupon_code ? String(updates.coupon_code).trim().toUpperCase() : null;
    if (updates.min_order_amount !== undefined) rawPayload.min_order_amount = updates.min_order_amount === '' ? null : Number(updates.min_order_amount);
    if (updates.max_discount !== undefined) rawPayload.max_discount = updates.max_discount === '' ? null : Number(updates.max_discount);
    if (updates.delivery_time_text !== undefined) rawPayload.delivery_time_text = updates.delivery_time_text ? String(updates.delivery_time_text).trim() : null;
    if (updates.variants !== undefined) rawPayload.variants = updates.variants;

    let payload = sanitizeProductPayload(rawPayload);

    let { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    // Graceful fallback if extended columns have not been migrated in SQL yet
    if (error && error.code === '42703') {
      const fallbackPayload = {};
      for (const [k, v] of Object.entries(payload)) {
        if (!NEW_EXTENDED_COLUMNS.has(k)) fallbackPayload[k] = v;
      }
      const retry = await supabase.from('products').update(fallbackPayload).eq('id', id).select().maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error updating product:', error.message);
      throw new Error(error.message);
    }

    if (!data) {
      // If product ID was not found in Supabase (e.g. was stored only in localStorage or previous create had failed),
      // auto-create it if basic fields (name, price) exist.
      if (rawPayload.name && (rawPayload.base_price !== undefined || updates.price !== undefined)) {
        console.log(`Product ID '${id}' not found during update, creating in database now...`);
        const insertPayload = sanitizeProductPayload({
          ...rawPayload,
          id
        });
        const { data: inserted, error: insertErr } = await supabase
          .from('products')
          .insert([insertPayload])
          .select()
          .maybeSingle();

        if (insertErr) {
          console.error('Error auto-creating product during update fallback:', insertErr.message);
          throw new Error(insertErr.message);
        }
        return inserted;
      }
      return null;
    }

    return data;
  },

  updateStock: async (id, newStock) => {
    const { data, error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating stock:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error.message);
      throw new Error(error.message);
    }
    return true;
  },

  // Delete many products in one statement: all of them or (on error) none. Returns the deleted ids.
  deleteMany: async (ids) => {
    const { data, error } = await supabase
      .from('products')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('Error deleting products:', error.message);
      // 23503 = foreign key violation: wishlists / reviews still point at a product
      if (error.code === '23503') {
        throw Object.assign(
          new Error('Some of these products are still in wishlists or reviews, so nothing was deleted. Deactivate them instead.'),
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }
    return (data || []).map((row) => row.id);
  }
};
