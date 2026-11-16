import { supabase } from '../config/supabase.js';
import { couponModel } from '../models/couponModel.js';
import { userEventsModel } from '../models/userEventsModel.js';
import { isDeliveryArea } from '../config/deliveryAreas.js';

// Delivery dates are Indian (IST) calendar days, bookable from today up to 7 days ahead. The checkout enforces the
// exact window; here one day of slack on each side covers shoppers whose phone clock is in another time zone.
const MAX_ADVANCE_DAYS = 7;

// The handwritten note is limited to 30 words (the checkout enforces it too; this keeps a hand-made request honest)
const NOTE_WORD_LIMIT = 30;
const limitNoteWords = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  return text.split(/\s+/).slice(0, NOTE_WORD_LIMIT).join(' ').slice(0, 300);
};

// The hamper studio sells a made-to-order item that is not a row in `products`; its price lives here, never in the browser
const BESPOKE_PRODUCT_ID = 'bespoke-hamper';
const BESPOKE_HAMPER_PRICE = 185;
const istDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offsetDays * 86_400_000));
const isBookableDeliveryDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  value >= istDate(-1) &&
  value <= istDate(MAX_ADVANCE_DAYS + 1);

const fail = (status, message) => ({ ok: false, status, message });

/**
 * Validates a checkout request and computes every amount on the SERVER (never trusts totals sent by the browser).
 * Used by both cash-on-delivery orders and online (Razorpay) orders, so the amount shown is the amount charged.
 *
 * Returns { ok: false, status, message } or { ok: true, orderData, meta }.
 */
/**
 * The browser only says WHAT was bought (product, variant, quantity); the price always comes from the database.
 * Returns { ok: true, items } with trusted name/price/quantity on every line, or { ok: false, status, message }.
 */
const priceItemsFromDatabase = async (rawItems) => {
  const productIds = [...new Set(rawItems.map((item) => item?.productId || item?.product_id).filter((id) => id && id !== BESPOKE_PRODUCT_ID))];

  const dbProducts = {};
  if (productIds.length > 0) {
    const { data, error } = await supabase.from('products').select('id, name, base_price, is_active, variants, seller_id').in('id', productIds);
    if (error) return fail(500, 'We could not verify the prices of your items. Please try again.');
    (data || []).forEach((row) => { dbProducts[row.id] = row; });
  }

  const items = [];
  for (const raw of rawItems) {
    const productId = raw?.productId || raw?.product_id;
    if (!productId) return fail(400, 'One of the items in your cart is invalid. Please remove it and add it again.');
    const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 1));

    if (productId === BESPOKE_PRODUCT_ID) {
      items.push({ ...raw, productId, product_id: productId, price: BESPOKE_HAMPER_PRICE, quantity, addons: undefined });
      continue;
    }

    const product = dbProducts[productId];
    if (!product || product.is_active === false) {
      return fail(400, `${raw.name || 'An item'} is no longer available. Please remove it from your cart.`);
    }

    let price = Number(product.base_price);
    const variantId = raw.variant?.id;
    if (variantId) {
      const variant = (Array.isArray(product.variants) ? product.variants : []).find((v) => v?.id === variantId);
      if (!variant) return fail(400, `The selected option of ${product.name} is no longer available. Please add it again.`);
      price = Number(variant.price);
    }
    if (!Number.isFinite(price) || price < 0) return fail(500, `${product.name} has no valid price. Please contact support.`);

    // Add-ons are not stored in the database, so a price the browser adds for them can never be trusted
    items.push({ ...raw, productId, product_id: productId, name: product.name, price, quantity, addons: undefined });
  }
  // Products of partner sellers are paid online only (the seller is paid out of the online payment)
  const sellerItems = items.filter((item) => item.productId !== BESPOKE_PRODUCT_ID && dbProducts[item.productId]?.seller_id);
  return { ok: true, items, onlineOnly: sellerItems.length > 0, onlineOnlyNames: sellerItems.map((item) => item.name) };
};

export const prepareOrder = async (body) => {
  const {
    buyer_id,
    user_id,
    items,
    delivery_address,
    details,
    delivery_date,
    delivery_slot,
    deliveryLabel,
    is_same_day,
    payment_method,
    payment,
    gift_message,
    delivery_instructions
  } = body;

  const finalBuyerId = buyer_id || user_id || null;
  if (!finalBuyerId) {
    return fail(401, 'Login required. You must be signed in to place and book an order.');
  }

  if (delivery_date && !isBookableDeliveryDate(delivery_date)) {
    return fail(400, `Please choose a delivery date from today up to ${MAX_ADVANCE_DAYS} days ahead.`);
  }

  const rawItems = Array.isArray(items) ? items : [];
  if (rawItems.length === 0) {
    return fail(400, 'Cart is empty. Please add gifts to your cart before checking out.');
  }

  // The delivery area is stored as the order's city; only the areas the checkout offers can be delivered to
  const requestedArea = (details?.city || body.city || '').trim();
  if (!isDeliveryArea(requestedArea)) {
    return fail(400, 'We do not deliver to this area yet. Please choose one of our delivery areas in Ajmer.');
  }

  // Prices come from the database (see priceItemsFromDatabase), whatever the browser sent
  const priced = await priceItemsFromDatabase(rawItems);
  if (!priced.ok) return priced;
  const itemsList = priced.items;

  // 1. Server-side Recompute Subtotal: price x quantity per line (a line's price already includes its add-ons),
  // the same formula the checkout page uses, so the amount shown always matches the amount charged
  const computedSubtotal = couponModel.cartSubtotal(itemsList);

  // 2. Server-side Delivery fee from Database (prices are tax-inclusive: no separate tax line)
  const productIds = itemsList.map((it) => it.productId || it.product_id || it.id).filter(Boolean);
  let dbDeliveryFee = 0;
  let hasDbDeliveryCharge = false;

  if (productIds.length > 0) {
    try {
      const { data: dbProducts } = await supabase
        .from('products')
        .select('id, delivery_charge, is_free_delivery')
        .in('id', productIds);

      if (Array.isArray(dbProducts) && dbProducts.length > 0) {
        for (const prod of dbProducts) {
          if (prod.is_free_delivery) {
            // Free delivery on this product: ignore delivery_charge
            continue;
          }
          if (prod.delivery_charge !== null && prod.delivery_charge !== undefined && prod.delivery_charge !== '') {
            hasDbDeliveryCharge = true;
            dbDeliveryFee = Math.max(dbDeliveryFee, Number(prod.delivery_charge) || 0);
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching product delivery charges from DB:', err);
    }
  }

  // Only a product's own delivery_charge costs anything; otherwise delivery is free, exactly as the checkout shows it.
  // The fee sent by the browser is never used.
  const computedDeliveryFee = hasDbDeliveryCharge ? dbDeliveryFee : 0;

  // 3. Server-side Coupon Verification & Recomputation (site-wide coupons hit every item, product coupons only theirs)
  let finalDiscount = 0;
  let verifiedCouponCode = null;

  const rawCoupon = (body.coupon_code || body.coupon || '').trim().toUpperCase();
  if (rawCoupon) {
    const couponValidation = await couponModel.validateCoupon(rawCoupon, computedSubtotal, finalBuyerId, itemsList);
    if (!couponValidation.valid) {
      return fail(400, couponValidation.message || `Coupon "${rawCoupon}" could not be applied.`);
    }
    finalDiscount = Number(couponValidation.discount) || 0;
    verifiedCouponCode = couponValidation.coupon.code;
  }

  // 4. Server-side Final Amount
  const finalAmount = Math.max(0, Math.round((computedSubtotal + computedDeliveryFee - finalDiscount) * 100) / 100);

  // Normalize payment method to 'Card' | 'UPI' | 'COD'
  let finalPaymentMethod = 'UPI';
  const rawPm = String(payment_method || payment || '').toLowerCase();
  if (rawPm.includes('card')) finalPaymentMethod = 'Card';
  else if (rawPm.includes('cod') || rawPm.includes('cash')) finalPaymentMethod = 'COD';
  if (finalPaymentMethod === 'COD' && priced.onlineOnly) {
    return fail(400, `Cash on delivery is not available for ${priced.onlineOnlyNames.slice(0, 2).join(' and ')}. Please pay online.`);
  }

  // 5. Structured recipient and address extraction
  const rawDetails = details || {};
  const recipientName = (rawDetails.name || body.recipient_name || '').trim();
  const recipientPhone = (rawDetails.phone || body.recipient_phone || '').trim();
  const addressLine = (rawDetails.address || body.address_line || '').trim();
  const city = (rawDetails.city || body.city || '').trim();
  const state = (rawDetails.state || body.state || 'India').trim();
  const pincode = (rawDetails.pincode || body.pincode || '').trim();
  const finalGiftMessage = limitNoteWords(gift_message || rawDetails.gift_message || rawDetails.message || null);
  const finalDeliveryInstructions = delivery_instructions || rawDetails.delivery_instructions || null;

  let finalAddress = delivery_address;
  if (!finalAddress) {
    finalAddress = `${recipientName} | ${recipientPhone} | ${addressLine}, ${city} ${pincode}`.trim();
  }

  const orderData = {
    buyer_id: finalBuyerId,
    items: itemsList,
    subtotal: computedSubtotal,
    delivery_fee: computedDeliveryFee,
    tax: 0,
    discount_amount: finalDiscount,
    coupon_code: verifiedCouponCode,
    total_amount: finalAmount,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    address_line: addressLine,
    city,
    state,
    pincode,
    delivery_address: finalAddress || 'Standard Delivery',
    delivery_date: delivery_date || new Date().toISOString().split('T')[0],
    delivery_slot: delivery_slot || deliveryLabel || 'Standard',
    is_same_day: Boolean(is_same_day),
    gift_message: finalGiftMessage,
    delivery_instructions: finalDeliveryInstructions,
    payment_method: finalPaymentMethod,
    // The browser never decides payment status: COD is paid on delivery, online orders are marked paid only after
    // the payment is verified with Razorpay (see paymentController)
    payment_status: 'pending',
    order_status: 'placed',
    payment_ref: null
  };

  return {
    ok: true,
    orderData,
    meta: {
      buyerId: finalBuyerId,
      couponCode: verifiedCouponCode,
      sessionId: body.session_id || null,
      recipientPhone,
      addressLine,
      city,
      pincode,
      itemCount: itemsList.length
    }
  };
};

/**
 * Work that must happen exactly once per placed order: coupon usage, profile auto-fill and purchase analytics.
 * Runs right away for cash on delivery and only after a verified payment for online orders.
 */
export const runOrderPlacedEffects = async (order, meta) => {
  if (meta.couponCode && !meta.couponAlreadyClaimed) {
    try {
      await couponModel.incrementUsageCount(meta.couponCode, meta.buyerId);
    } catch (err) {
      console.warn('⚠️ Could not increment coupon usage:', err.message);
    }
  }

  setImmediate(async () => {
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('phone, address_line, city, pincode')
        .eq('id', meta.buyerId)
        .single();

      const profileUpdates = {};
      if ((!userProfile?.phone || userProfile.phone.trim() === '') && meta.recipientPhone) {
        profileUpdates.phone = meta.recipientPhone;
      }
      if ((!userProfile?.address_line || userProfile.address_line.trim() === '') && meta.addressLine) {
        profileUpdates.address_line = meta.addressLine;
        if (meta.city) profileUpdates.city = meta.city;
        if (meta.pincode) profileUpdates.pincode = meta.pincode;
      }

      if (Object.keys(profileUpdates).length > 0) {
        await supabase.from('users').update(profileUpdates).eq('id', meta.buyerId);
      }
    } catch (profileErr) {
      console.warn('⚠️ Could not update user profile from checkout:', profileErr.message);
    }
  });

  setImmediate(async () => {
    try {
      await userEventsModel.recordEvent({
        user_id: meta.buyerId,
        session_id: meta.sessionId,
        event_type: 'purchase',
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          subtotal: order.subtotal,
          total_amount: order.total_amount,
          discount_amount: order.discount_amount,
          coupon_code: meta.couponCode,
          item_count: meta.itemCount,
          payment_method: order.payment_method,
          is_same_day: Boolean(order.is_same_day),
          delivery_slot: order.delivery_slot || 'Standard'
        }
      });
    } catch (eventErr) {
      console.warn('⚠️ [PurchaseTracking] Could not record purchase event:', eventErr.message);
    }
  });
};
