import { supabase } from '../config/supabase.js';
import { generateDeliveryOtp } from '../src/services/otp.js';

// Delivery data (partner, OTP, timestamps, issue) lives in columns of `orders`. Older rows may still carry it as a hidden
// "__delivery_meta" entry inside items: it is read as a fallback and never shown as a product.
const isLegacyMeta = (item) => item && item.__delivery_meta === true;
const withoutLegacyMeta = (items) => (Array.isArray(items) ? items.filter((item) => !isLegacyMeta(item)) : []);

export const formatOrder = (order) => {
  if (!order) return null;
  const items = Array.isArray(order.items) ? order.items : [];
  const legacy = items.find(isLegacyMeta) || null;

  const partnerId = order.delivery_partner_id ?? legacy?.delivery_partner_id ?? null;
  const partnerName = order.delivery_partner_name ?? legacy?.delivery_partner_name ?? null;
  const partnerPhone = order.delivery_partner_phone ?? legacy?.delivery_partner_phone ?? null;

  return {
    ...order,
    items: withoutLegacyMeta(items),
    delivery_partner_id: partnerId,
    delivery_partner_name: partnerName,
    delivery_partner_phone: partnerPhone,
    delivery_otp: order.delivery_otp ?? legacy?.delivery_otp ?? null,
    out_for_delivery_at: order.out_for_delivery_at ?? legacy?.out_for_delivery_at ?? null,
    delivered_at: order.delivered_at ?? legacy?.delivered_at ?? null,
    delivery_issue: order.delivery_issue ?? null,
    delivery_issue_at: order.delivery_issue_at ?? null,
    delivery_partner: partnerId ? { id: partnerId, name: partnerName, phone: partnerPhone } : null
  };
};

export const generateFriendlyOrderNumber = () => {
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `PP-${dateStr}-${randomPart}`;
};

export const orderModel = {
  findAll: async (filters = {}) => {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.buyer_id) {
      query = query.eq('buyer_id', filters.buyer_id);
    }
    if (filters.order_status) {
      query = query.eq('order_status', filters.order_status);
    }
    if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }
    if (filters.payment_method) {
      query = query.eq('payment_method', filters.payment_method);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching orders:', error.message);
      throw new Error(error.message);
    }
    return (data || []).map(formatOrder);
  },

  findById: async (id) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding order:', error.message);
      throw new Error(error.message);
    }
    return formatOrder(data);
  },

  findByBuyerId: async (buyerId) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error finding orders for buyer ${buyerId}:`, error.message);
      throw new Error(error.message);
    }
    return (data || []).map(formatOrder);
  },

  findByUserId: async (userId) => {
    return orderModel.findByBuyerId(userId);
  },

  create: async (orderData) => {
    // Generate initial delivery confirmation OTP upon creation
    const deliveryOtp = generateDeliveryOtp();

    const productItems = withoutLegacyMeta(orderData.items);

    const fallbackAddress = `${orderData.recipient_name || ''} | ${orderData.recipient_phone || ''} | ${orderData.address_line || ''}, ${orderData.city || ''} ${orderData.pincode || ''}`.trim();

    const payload = {
      order_number: orderData.order_number || generateFriendlyOrderNumber(),
      buyer_id: orderData.buyer_id || orderData.user_id || null,
      items: productItems,
      delivery_otp: deliveryOtp,
      subtotal: Number(orderData.subtotal || 0),
      delivery_fee: Number(orderData.delivery_fee || 0),
      tax: Number(orderData.tax || 0),
      discount_amount: Number(orderData.discount_amount || 0),
      coupon_code: orderData.coupon_code || null,
      total_amount: orderData.total_amount !== undefined ? Number(orderData.total_amount) : Number(orderData.total || 0),
      recipient_name: orderData.recipient_name || '',
      recipient_phone: orderData.recipient_phone || '',
      address_line: orderData.address_line || '',
      city: orderData.city || '',
      state: orderData.state || 'India',
      pincode: orderData.pincode || '',
      delivery_address: orderData.delivery_address || fallbackAddress || 'Standard Delivery',
      delivery_date: orderData.delivery_date || null,
      delivery_slot: orderData.delivery_slot || null,
      is_same_day: orderData.is_same_day !== undefined ? Boolean(orderData.is_same_day) : false,
      gift_message: orderData.gift_message || null,
      delivery_instructions: orderData.delivery_instructions || null,
      payment_method: orderData.payment_method || 'UPI',
      payment_status: orderData.payment_status || 'pending',
      order_status: orderData.order_status || orderData.status || 'placed',
      payment_ref: orderData.payment_ref || null,
      updated_at: new Date().toISOString()
    };

    // Order numbers have 9,000 random values per day, so two orders can draw the same one: on that unique-key clash
    // (Postgres 23505 on order_number) draw a new number and try again instead of failing the checkout
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; ; attempt += 1) {
      const { data, error } = await supabase
        .from('orders')
        .insert([payload])
        .select()
        .single();

      if (!error) return formatOrder(data);

      const numberClash = error.code === '23505' && /order_number/i.test(`${error.message} ${error.details || ''}`);
      if (numberClash && !orderData.order_number && attempt < MAX_ATTEMPTS) {
        payload.order_number = generateFriendlyOrderNumber();
        continue;
      }
      console.error('Error creating order:', error.message);
      throw new Error(error.message);
    }
  },

  // Payment bookkeeping (Razorpay). `fields` may hold payment_status, payment_ref, payment_method, order_status.
  updatePayment: async (orderId, fields) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error updating order payment:', error.message);
      throw new Error(error.message);
    }
    return formatOrder(data);
  },

  // Marks an order paid only if it is not paid yet: 'pending', or 'failed' when the order was given up as unpaid and the
  // money arrived late. Returns the updated order, or null when another request (verify, webhook, reconciler) already
  // settled it, so side effects (coupon usage, analytics, refunds) run exactly once.
  markPaidIfPending: async (orderId, fields) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ ...fields, payment_status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .in('payment_status', ['pending', 'failed'])
      .select();

    if (error) {
      console.error('Error marking order paid:', error.message);
      throw new Error(error.message);
    }
    return data && data.length > 0 ? formatOrder(data[0]) : null;
  },

  // The order a Razorpay order id belongs to (payment_ref is "razorpay:<order_id>" or "razorpay:<order_id>:<pay_id>")
  findByRazorpayOrderId: async (rzpOrderId) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .like('payment_ref', `razorpay:${rzpOrderId}%`)
      .limit(5);

    if (error) throw new Error(error.message);
    // LIKE treats "_" as a wildcard: keep only the exact match
    const exact = (data || []).find((row) => String(row.payment_ref).split(':')[1] === rzpOrderId);
    return formatOrder(exact || null);
  },

  // Online orders still waiting for payment that were created before `olderThan` (for the reconciler)
  findAwaitingPayment: async (olderThan, limit = 50) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_status', 'awaiting_payment')
      .lt('created_at', olderThan.toISOString())
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data || []).map(formatOrder);
  },

  // A buyer's online orders still waiting for payment, created after `since` (newest first)
  findAwaitingByBuyer: async (buyerId, since) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('buyer_id', buyerId)
      .eq('order_status', 'awaiting_payment')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw new Error(error.message);
    return (data || []).map(formatOrder);
  },

  // Gives up an unpaid online order. Only while it is still unpaid: the condition is part of the UPDATE, so a payment
  // confirmed at the same moment wins. Returns the cancelled order, or null when it was paid (or already closed).
  cancelUnpaidOnline: async (orderId) => {
    const attempt = (fields) =>
      supabase
        .from('orders')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('payment_status', 'pending')
        .in('order_status', ['awaiting_payment', 'placed'])
        .select();

    let { data, error } = await attempt({ order_status: 'cancelled', payment_status: 'failed' });
    // A database that does not allow payment_status 'failed' yet (migration 024 not run): cancelling is what matters
    if (error) ({ data, error } = await attempt({ order_status: 'cancelled' }));
    if (error) throw new Error(error.message);
    return data && data.length > 0 ? formatOrder(data[0]) : null;
  },

  // Refunds are issued by hand from the Razorpay dashboard. A cancelled paid order is flagged 'due' here, once: only
  // the caller that moves refund_status from "none" gets the order back (and sends the admin alert), so a cancellation
  // racing a late payment never alerts twice. Returns the order, or null when it was already flagged.
  markRefundDue: async (orderId) => {
    const { data: current, error: readError } = await supabase.from('orders').select('total_amount').eq('id', orderId).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) return null;

    const { data, error } = await supabase
      .from('orders')
      .update({ refund_status: 'due', refund_amount: current.total_amount, refund_error: null, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('payment_status', 'paid')
      .is('refund_status', null)
      .select();

    if (error) throw new Error(error.message);
    return data && data.length > 0 ? formatOrder(data[0]) : null;
  },

  // A cancelled order that is opened again before the refund was sent: Razorpay still holds the money, so nothing is due
  clearRefundDue: async (orderId) => {
    const { error } = await supabase
      .from('orders')
      .update({ refund_status: null, refund_amount: null, refund_error: null })
      .eq('id', orderId)
      .eq('refund_status', 'due');
    if (error) throw new Error(error.message);
  },

  // Records a full refund, once: only while the order is still 'paid', so the webhook and the admin's "Mark as
  // refunded" arriving together update it (and notify the customer) a single time. Returns null when already refunded.
  markRefunded: async (orderId, fields) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ ...fields, refund_status: 'processed', payment_status: 'refunded', refund_error: null, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('payment_status', 'paid')
      .select();

    if (error) throw new Error(error.message);
    return data && data.length > 0 ? formatOrder(data[0]) : null;
  },

  // The order a Razorpay payment id belongs to (payment_ref is "razorpay:<order_id>:<pay_id>" once paid)
  findByRazorpayPaymentId: async (rzpPaymentId) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .like('payment_ref', `razorpay:%:${rzpPaymentId}`)
      .limit(5);

    if (error) throw new Error(error.message);
    // LIKE treats "_" as a wildcard: keep only the exact match
    const exact = (data || []).find((row) => String(row.payment_ref).split(':')[2] === rzpPaymentId);
    return formatOrder(exact || null);
  },

  // Assign delivery partner to order (a new assignment also clears any earlier "failed / reschedule" report)
  assignRider: async (orderId, partner) => {
    const rawOrder = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!rawOrder.data) throw new Error('Order not found');

    const order = rawOrder.data;
    const current = formatOrder(order);

    // Keep the existing OTP or generate a new 4-digit code
    const deliveryOtp = current.delivery_otp || generateDeliveryOtp();
    const nextStatus = order.order_status === 'placed' ? 'processing' : order.order_status;

    const { data, error } = await supabase
      .from('orders')
      .update({
        items: current.items,
        delivery_partner_id: partner.id,
        delivery_partner_name: partner.name,
        delivery_partner_phone: partner.phone,
        delivery_otp: deliveryOtp,
        assigned_at: new Date().toISOString(),
        delivered_at: null,
        delivery_issue: null,
        delivery_issue_at: null,
        order_status: nextStatus
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error assigning rider:', error.message);
      throw new Error(error.message);
    }
    return formatOrder(data);
  },

  // Find all orders assigned to a specific delivery partner / rider
  findByRiderId: async (riderId) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_partner_id', riderId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(formatOrder);
  },

  // Rider marks order as Out for Delivery
  markOutForDelivery: async (orderId, riderId) => {
    const rawOrder = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!rawOrder.data) throw new Error('Order not found');

    const current = formatOrder(rawOrder.data);

    const { data, error } = await supabase
      .from('orders')
      .update({
        items: current.items,
        out_for_delivery_at: new Date().toISOString(),
        delivery_otp: current.delivery_otp || generateDeliveryOtp(),
        order_status: 'out_for_delivery'
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return formatOrder(data);
  },

  // Verify Delivery Confirmation OTP and complete delivery
  verifyDeliveryOtp: async (orderId, enteredOtp) => {
    const rawOrder = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!rawOrder.data) throw new Error('Order not found');

    const order = rawOrder.data;

    // Must be Out for Delivery before OTP verification
    if (order.order_status !== 'out_for_delivery') {
      throw new Error('Order must be marked "Out for Delivery" first before customer doorstep OTP can be verified.');
    }

    const current = formatOrder(order);
    const actualOtp = current.delivery_otp;
    const cleanEntered = String(enteredOtp).trim();

    if (!actualOtp) {
      throw new Error('No delivery confirmation OTP is associated with this order.');
    }

    if (actualOtp !== cleanEntered) {
      throw new Error(`Invalid Delivery Confirmation OTP. Please ask the customer for the correct 4-digit code.`);
    }

    // OTP verified! Mark delivered
    const updates = {
      items: current.items,
      delivered_at: new Date().toISOString(),
      order_status: 'delivered'
    };

    // If COD order, mark payment as paid upon successful delivery
    if (order.payment_method === 'COD' && order.payment_status !== 'paid') {
      updates.payment_status = 'paid';
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return formatOrder(data);
  },

  // The rider reports that the handover did not happen ('failed') or has to be moved ('reschedule').
  // Only the assigned rider, only while the order is still open, and only once: the condition is part of the UPDATE.
  reportDeliveryIssue: async (orderId, riderId, issue) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ delivery_issue: issue, delivery_issue_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('delivery_partner_id', riderId)
      .is('delivery_issue', null)
      .in('order_status', ['processing', 'out_for_delivery'])
      .select();

    if (error) throw new Error(error.message);
    return data && data.length > 0 ? formatOrder(data[0]) : null;
  },

  // A customer cancels their own order: only while it has not left for delivery. The status check is part of the
  // UPDATE itself, so a rider marking it out for delivery at the same moment cannot be overwritten.
  cancelByBuyer: async (orderId, buyerId) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ order_status: 'cancelled' })
      .eq('id', orderId)
      .eq('buyer_id', buyerId)
      .in('order_status', ['placed', 'processing'])
      .select();

    if (error) throw new Error(error.message);
    return data && data.length > 0 ? formatOrder(data[0]) : null;
  },

  updateStatus: async (id, orderStatus) => {
    const valid = ['placed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!valid.includes(orderStatus)) {
      throw new Error(`Invalid order status: ${orderStatus}. Must be one of ${valid.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ order_status: orderStatus, delivery_issue: null, delivery_issue_at: null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating order status:', error.message);
      throw new Error(error.message);
    }
    return formatOrder(data);
  },

  updatePaymentStatus: async (id, paymentStatus) => {
    const valid = ['pending', 'paid', 'failed'];
    if (!valid.includes(paymentStatus)) {
      throw new Error(`Invalid payment status: ${paymentStatus}. Must be one of ${valid.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ payment_status: paymentStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment status:', error.message);
      throw new Error(error.message);
    }
    return formatOrder(data);
  },

  update: async (id, updates) => {
    const payload = { ...updates };
    if (payload.status && !payload.order_status) {
      payload.order_status = payload.status;
      delete payload.status;
    }
    if (payload.total !== undefined && payload.total_amount === undefined) {
      payload.total_amount = payload.total;
      delete payload.total;
    }

    const { data, error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating order:', error.message);
      throw new Error(error.message);
    }
    return formatOrder(data);
  },

  // Delete many orders in one statement: all of them or (on error) none. Returns the deleted ids.
  deleteMany: async (ids) => {
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('Error deleting orders:', error.message);
      // 23503 = foreign key violation: reviews / customizations still point at an order
      if (error.code === '23503') {
        throw Object.assign(
          new Error('Some of these orders have reviews or customizations attached, so nothing was deleted.'),
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }
    return (data || []).map((row) => row.id);
  }
};

export default orderModel;
