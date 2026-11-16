import { supabase } from '../config/supabase.js';

const roundMoney = (value) => Math.round(value * 100) / 100;

// In-memory mutex lock for atomic coupon claims within the Node process
class AsyncLock {
  constructor() {
    this.locks = new Map();
  }

  async acquire(key) {
    while (this.locks.has(key)) {
      try {
        await this.locks.get(key);
      } catch {
        // Continue even if previous lock holder threw
      }
    }
    let release;
    const promise = new Promise((resolve) => {
      release = resolve;
    });
    this.locks.set(key, promise);
    return () => {
      this.locks.delete(key);
      release();
    };
  }
}

const couponLock = new AsyncLock();

// A cart item's price already includes its add-ons (see ProductDetailPage), so a line is price x quantity.
const itemProductId = (item) => item?.productId || item?.product_id || item?.id || null;
const itemLineTotal = (item) =>
  Math.max(0, Number(item?.price) || 0) * Math.max(1, Number(item?.quantity) || 1);

export const couponModel = {
  // Order subtotal from cart lines: the one formula shared by coupon validation and order creation
  cartSubtotal: (items) =>
    roundMoney((Array.isArray(items) ? items : []).reduce((sum, item) => sum + itemLineTotal(item), 0)),

  findAll: async (filters = {}) => {
    let query = supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (typeof filters.is_active === 'boolean') {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.discount_type) {
      query = query.eq('discount_type', filters.discount_type);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching coupons:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding coupon:', error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  findByCode: async (code) => {
    if (!code || typeof code !== 'string') return null;
    const cleanCode = code.trim().toUpperCase();
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', cleanCode)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error finding coupon ${cleanCode}:`, error.message);
      throw new Error(error.message);
    }
    return data || null;
  },

  getUsageCount: async (code) => {
    try {
      const clean = code.trim().toUpperCase();
      const { data, error } = await supabase
        .from('coupons')
        .select('used_count')
        .eq('code', clean)
        .single();
      if (!error && data && data.used_count !== undefined && data.used_count !== null) {
        return Number(data.used_count);
      }
      return 0;
    } catch {
      return 0;
    }
  },

  /**
   * Atomically claims and increments a coupon's usage count with strict concurrency locking.
   * Prevents race conditions where two concurrent checkouts exceed usage_limit or per_user_limit.
   *
   * @param {string} code - The coupon code to claim
   * @param {string|null} userId - The buyer's ID to enforce per_user_limit and first_order_only
   * @returns {Promise<{success: boolean, message?: string, error_code?: string, used_count?: number}>}
   */
  claimCouponAtomic: async (code, userId = null) => {
    if (!code || typeof code !== 'string' || !code.trim()) {
      return { success: false, error_code: 'INVALID_CODE', message: 'Please provide a coupon code.' };
    }
    const cleanCode = code.trim().toUpperCase();
    const releaseLock = await couponLock.acquire(cleanCode);

    try {
      // 1. Attempt PostgreSQL stored procedure (row-level FOR UPDATE locking in PostgreSQL)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('claim_coupon_atomic', {
          p_code: cleanCode,
          p_user_id: userId || null
        });

        if (!rpcError && rpcData && typeof rpcData === 'object') {
          return rpcData;
        }
      } catch (rpcEx) {
        // Fall back to application-level atomic CAS below if RPC is not deployed yet
      }

      // 2. Application-level Optimistic Concurrency Control (OCC) Fallback
      // Runs inside the coupon mutex lock, with CAS conditional update against Supabase DB
      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const coupon = await couponModel.findByCode(cleanCode);
        if (!coupon) {
          return { success: false, error_code: 'NOT_FOUND', message: `Coupon "${cleanCode}" not found.` };
        }
        if (!coupon.is_active) {
          return { success: false, error_code: 'INACTIVE', message: `Coupon "${coupon.code}" is currently disabled or inactive.` };
        }

        // Check expiry date
        if (coupon.expiry_date) {
          const expiry = new Date(coupon.expiry_date);
          const expiryDateObj = coupon.expiry_date.length === 10
            ? new Date(`${coupon.expiry_date}T23:59:59.999Z`)
            : expiry;
          if (expiryDateObj < new Date()) {
            return { success: false, error_code: 'EXPIRED', message: `Coupon "${coupon.code}" has expired.` };
          }
        }

        // Check global usage limit strictly
        const currentUsed = Number(coupon.used_count || 0);
        if (coupon.usage_limit && Number(coupon.usage_limit) > 0 && currentUsed >= Number(coupon.usage_limit)) {
          return {
            success: false,
            error_code: 'LIMIT_EXCEEDED',
            message: `Coupon "${coupon.code}" has reached its maximum global usage limit of ${coupon.usage_limit}.`,
            used_count: currentUsed,
            usage_limit: coupon.usage_limit
          };
        }

        // Check per-user limit strictly
        if (userId && coupon.per_user_limit && Number(coupon.per_user_limit) > 0) {
          const { count, error: countErr } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('buyer_id', userId)
            .eq('coupon_code', coupon.code)
            .not('order_status', 'in', '(cancelled,awaiting_payment)');

          if (!countErr && count !== null && count >= Number(coupon.per_user_limit)) {
            return {
              success: false,
              error_code: 'USER_LIMIT_EXCEEDED',
              message: `You have reached the maximum allowed usage limit (${coupon.per_user_limit}) for coupon "${coupon.code}".`,
              per_user_limit: coupon.per_user_limit
            };
          }
        }

        // Check first order only rule
        if (userId && coupon.first_order_only) {
          const { count: orderCount, error: orderCountErr } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('buyer_id', userId)
            .not('order_status', 'in', '(cancelled,awaiting_payment)');

          if (!orderCountErr && orderCount && orderCount > 0) {
            return {
              success: false,
              error_code: 'FIRST_ORDER_ONLY',
              message: `Coupon "${coupon.code}" is only valid for your first order.`
            };
          }
        }

        // Perform CAS conditional update: ensure used_count hasn't changed since we read it
        let updateQuery = supabase
          .from('coupons')
          .update({
            used_count: currentUsed + 1
          })
          .eq('id', coupon.id);

        if (!coupon.used_count || coupon.used_count === 0) {
          updateQuery = updateQuery.or('used_count.is.null,used_count.eq.0');
        } else {
          updateQuery = updateQuery.eq('used_count', currentUsed);
        }

        const { data: updatedRows, error: updateErr } = await updateQuery.select();
        if (!updateErr && updatedRows && updatedRows.length > 0) {
          return {
            success: true,
            coupon_id: coupon.id,
            code: coupon.code,
            used_count: currentUsed + 1,
            usage_limit: coupon.usage_limit
          };
        }
      }

      return {
        success: false,
        error_code: 'CONCURRENCY_CONFLICT',
        message: 'Could not claim coupon due to high concurrent traffic. Please try again.'
      };
    } finally {
      releaseLock();
    }
  },

  /**
   * Atomically releases / decrements coupon usage count when an order is cancelled or rolled back.
   */
  releaseCouponAtomic: async (code) => {
    if (!code || typeof code !== 'string' || !code.trim()) {
      return { success: false, message: 'Invalid coupon code.' };
    }
    const cleanCode = code.trim().toUpperCase();
    const releaseLock = await couponLock.acquire(cleanCode);

    try {
      // 1. Attempt PostgreSQL stored procedure
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('release_coupon_atomic', {
          p_code: cleanCode
        });
        if (!rpcError && rpcData && typeof rpcData === 'object') {
          return rpcData;
        }
      } catch {}

      // 2. Application-level fallback
      const coupon = await couponModel.findByCode(cleanCode);
      if (!coupon) return { success: false, message: 'Coupon not found.' };

      const currentUsed = Number(coupon.used_count || 0);
      const newCount = Math.max(0, currentUsed - 1);

      await supabase
        .from('coupons')
        .update({ used_count: newCount })
        .eq('id', coupon.id);

      return { success: true, coupon_id: coupon.id, code: coupon.code, used_count: newCount };
    } catch (err) {
      console.warn('⚠️ Could not release coupon used_count:', err.message);
      return { success: false, error: err.message };
    } finally {
      releaseLock();
    }
  },

  incrementUsageCount: async (code, userId = null) => {
    try {
      if (!code) return;
      return await couponModel.claimCouponAtomic(code, userId);
    } catch (err) {
      console.warn('⚠️ Could not increment coupon used_count:', err.message);
    }
  },

  // Promo code saved on a product (Admin > Products > Coupons & Discount Rules). It only discounts that product.
  // Product rows carry no discount % - just min_order_amount and max_discount - so max_discount is the flat saving
  // on the product, never more than the product's own line total. min_order_amount is checked against the whole cart.
  validateProductCoupon: async (cleanCode, orderAmount = 0, items = []) => {
    const invalid = { valid: false, message: `Invalid coupon code "${cleanCode}". Please verify and try again.` };

    const { data, error } = await supabase
      .from('products')
      .select('id, name, min_order_amount, max_discount, is_active')
      .eq('coupon_code', cleanCode);

    if (error) {
      console.error(`Error finding product coupon ${cleanCode}:`, error.message);
      throw new Error(error.message);
    }

    const promoProducts = (data || []).filter((product) => product.is_active !== false);
    if (promoProducts.length === 0) return invalid;

    const amountByProduct = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      const productId = itemProductId(item);
      if (productId) amountByProduct.set(productId, (amountByProduct.get(productId) || 0) + itemLineTotal(item));
    }

    const inCart = promoProducts.filter((product) => amountByProduct.has(product.id));
    if (inCart.length === 0) {
      const names = promoProducts.slice(0, 3).map((product) => product.name).join(', ');
      return {
        valid: false,
        message: `Coupon "${cleanCode}" is only valid on ${names}. Add it to your cart to use this code.`
      };
    }

    const numOrderAmount = Math.max(0, Number(orderAmount) || 0);
    let discount = 0;
    let smallestMinOrder = null;
    const discounted = [];

    for (const product of inCart) {
      const minOrder = Number(product.min_order_amount) || 0;
      if (minOrder > 0 && numOrderAmount < minOrder) {
        smallestMinOrder = smallestMinOrder === null ? minOrder : Math.min(smallestMinOrder, minOrder);
        continue;
      }
      const saving = Math.min(Number(product.max_discount) || 0, amountByProduct.get(product.id));
      if (saving <= 0) continue;
      discount += saving;
      discounted.push(product);
    }

    if (discounted.length === 0) {
      if (smallestMinOrder !== null) {
        const shortfall = smallestMinOrder - numOrderAmount;
        return {
          valid: false,
          message: `Minimum order amount of ₹${smallestMinOrder.toLocaleString('en-IN')} required for coupon "${cleanCode}". Add ₹${shortfall.toLocaleString('en-IN')} more to your cart to apply.`,
          min_order_amount: smallestMinOrder,
          shortfall
        };
      }
      return { valid: false, message: `Coupon "${cleanCode}" has no discount set for this product.` };
    }

    discount = Math.min(roundMoney(discount), numOrderAmount);
    const productNames = discounted.map((product) => product.name);

    return {
      valid: true,
      applies_to: 'product',
      product_ids: discounted.map((product) => product.id),
      product_names: productNames,
      coupon: {
        id: discounted[0].id,
        code: cleanCode,
        discount_type: 'product',
        discount_value: discount,
        min_order_amount: discounted[0].min_order_amount,
        max_discount: discounted[0].max_discount,
        expiry_date: null
      },
      discount,
      final_amount: Math.max(0, numOrderAmount - discount),
      savings_text: `₹${discount.toLocaleString('en-IN')} OFF on ${productNames.join(', ')}`,
      message: `Coupon "${cleanCode}" applied on ${productNames.join(', ')}! You saved ₹${discount.toLocaleString('en-IN')}.`
    };
  },

  validateCoupon: async (code, orderAmount = 0, userId = null, items = []) => {
    if (!code || typeof code !== 'string' || !code.trim()) {
      return { valid: false, message: 'Please enter a coupon code.' };
    }

    const cleanCode = code.trim().toUpperCase();
    const coupon = await couponModel.findByCode(cleanCode);

    // Logic Gate 1: Check coupon existence. Not a site-wide coupon? It may be a product-specific promo code.
    if (!coupon) {
      return couponModel.validateProductCoupon(cleanCode, orderAmount, items);
    }

    // Logic Gate 2: Check active status
    if (!coupon.is_active) {
      return { valid: false, message: `Coupon "${coupon.code}" is currently disabled or inactive.` };
    }

    // Logic Gate 3: Check expiry date
    if (coupon.expiry_date) {
      const expiry = new Date(coupon.expiry_date);
      const expiryDateObj = coupon.expiry_date.length === 10 
        ? new Date(`${coupon.expiry_date}T23:59:59.999Z`) 
        : expiry;

      if (expiryDateObj < new Date()) {
        const formattedDate = expiry.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        return { valid: false, message: `Coupon "${coupon.code}" expired on ${formattedDate}.` };
      }
    }

    // Logic Gate 4: Check minimum order amount requirement
    const numOrderAmount = Math.max(0, Number(orderAmount) || 0);
    const minOrder = Number(coupon.min_order_amount) || 0;

    if (minOrder > 0 && numOrderAmount < minOrder) {
      const shortfall = minOrder - numOrderAmount;
      return { 
        valid: false, 
        message: `Minimum order amount of ₹${minOrder.toLocaleString('en-IN')} required for coupon "${coupon.code}". Add ₹${shortfall.toLocaleString('en-IN')} more to your cart to apply.`,
        min_order_amount: minOrder,
        shortfall
      };
    }

    // Logic Gate 5: Check first order only rule
    if (coupon.first_order_only && userId) {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', userId)
        // Cancelled orders and online checkouts still waiting for payment do not count as used
        .not('order_status', 'in', '(cancelled,awaiting_payment)');
      if (!error && count && count > 0) {
        return {
          valid: false,
          message: `Coupon "${coupon.code}" is only valid for your first order.`
        };
      }
    }

    // Logic Gate 6: Check per-user limit
    if (coupon.per_user_limit && Number(coupon.per_user_limit) > 0 && userId) {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', userId)
        .eq('coupon_code', coupon.code)
        // Cancelled orders and online checkouts still waiting for payment do not count as used
        .not('order_status', 'in', '(cancelled,awaiting_payment)');
      if (!error && count !== null && count >= Number(coupon.per_user_limit)) {
        return {
          valid: false,
          message: `You have reached the maximum allowed usage limit (${coupon.per_user_limit}) for coupon "${coupon.code}".`
        };
      }
    }

    // Logic Gate 7: Check global usage limit
    if (coupon.usage_limit && Number(coupon.usage_limit) > 0) {
      const timesUsed = coupon.used_count !== undefined && coupon.used_count !== null
        ? Number(coupon.used_count)
        : await couponModel.getUsageCount(coupon.code);
      if (timesUsed >= Number(coupon.usage_limit)) {
        return {
          valid: false,
          message: `Coupon "${coupon.code}" has reached its maximum global usage limit of ${coupon.usage_limit}.`
        };
      }
    }

    // Logic Gate 8: Calculate discount
    let discount = 0;
    const discountVal = Number(coupon.discount_value) || 0;

    if (coupon.discount_type === 'percentage') {
      discount = Math.round((numOrderAmount * discountVal) / 100);
    } else {
      discount = discountVal;
    }

    // Cap to max_discount if specified (prevents unbounded discounts on large orders)
    if (coupon.max_discount && Number(coupon.max_discount) > 0 && discount > Number(coupon.max_discount)) {
      discount = Number(coupon.max_discount);
    }

    // Discount cannot exceed the order subtotal
    discount = Math.min(discount, numOrderAmount);
    const finalAmount = Math.max(0, numOrderAmount - discount);

    const savingsText = coupon.discount_type === 'percentage'
      ? `${coupon.discount_value}% OFF (₹${discount.toLocaleString('en-IN')})`
      : `₹${discount.toLocaleString('en-IN')} OFF`;

    return {
      valid: true,
      applies_to: 'all',
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        min_order_amount: coupon.min_order_amount,
        max_discount: coupon.max_discount,
        expiry_date: coupon.expiry_date
      },
      discount,
      final_amount: finalAmount,
      savings_text: savingsText,
      message: `Coupon "${coupon.code}" applied successfully! You saved ₹${discount.toLocaleString('en-IN')}.`
    };
  },

  create: async (couponData) => {
    const payload = {
      code: couponData.code.trim().toUpperCase(),
      discount_type: couponData.discount_type, // 'flat' or 'percentage'
      discount_value: couponData.discount_value,
      min_order_amount: couponData.min_order_amount !== undefined ? couponData.min_order_amount : 0,
      max_discount: couponData.max_discount ? Number(couponData.max_discount) : null,
      expiry_date: couponData.expiry_date || null,
      usage_limit: couponData.usage_limit ? Number(couponData.usage_limit) : null,
      per_user_limit: couponData.per_user_limit ? Number(couponData.per_user_limit) : 1,
      first_order_only: couponData.first_order_only !== undefined ? Boolean(couponData.first_order_only) : false,
      is_active: couponData.is_active !== undefined ? couponData.is_active : true
    };

    const { data, error } = await supabase
      .from('coupons')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating coupon:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  update: async (id, updates) => {
    const payload = { ...updates };
    if (payload.code) payload.code = payload.code.trim().toUpperCase();

    const { data, error } = await supabase
      .from('coupons')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating coupon:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting coupon:', error.message);
      throw new Error(error.message);
    }
    return true;
  }
};
