import { orderModel } from '../models/orderModel.js';
import { razorpayService } from './razorpayService.js';
import { runOrderPlacedEffects } from './orderPricing.js';
import { notifyUser } from './notificationService.js';
import { alertRefundDue } from './adminAlerts.js';

// One place for everything that changes an online order's money state. The checkout's verify call, the "window
// closed" call, the Razorpay webhook, the background reconciler and order cancellations all go through here, so the
// rules (and the "exactly once" guarantees) are the same whichever arrives first.

// orders.payment_ref carries the Razorpay link for an online order:
//   "razorpay:order_XXXX"              created, waiting for the customer to pay
//   "razorpay:order_XXXX:pay_YYYY"     paid
export const parsePaymentRef = (ref) => {
  const [provider, rzpOrderId, rzpPaymentId] = String(ref || '').split(':');
  return provider === 'razorpay' ? { rzpOrderId: rzpOrderId || null, rzpPaymentId: rzpPaymentId || null } : {};
};

export const toPaise = (rupees) => Math.round(Number(rupees) * 100);

const fail = (status, message) => Object.assign(new Error(message), { status });

// Razorpay reports the method actually used; the order keeps the labels the rest of the app already understands
const methodLabel = (method, fallback) => (method === 'card' ? 'Card' : method === 'upi' ? 'UPI' : fallback);

const metaFromOrder = (order) => ({
  buyerId: order.buyer_id,
  couponCode: order.coupon_code || null,
  sessionId: null,
  recipientPhone: order.recipient_phone || '',
  addressLine: order.address_line || '',
  city: order.city || '',
  pincode: order.pincode || '',
  itemCount: Array.isArray(order.items) ? order.items.length : 0
});

const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/**
 * Confirms with Razorpay that this payment really paid this order, then marks it paid (once).
 *
 * Normally the order becomes 'placed'. If the order had already been given up as unpaid (the customer closed the
 * window while the bank was still confirming) the late money still counts: the order is restored when its delivery
 * date has not passed, otherwise it stays cancelled and is flagged "refund due" for the admins to refund by hand.
 *
 * Throws an error carrying `.status` (400 / 402) when the payment does not match or is not complete.
 */
export const settlePayment = async (order, rzpOrderId, rzpPaymentId) => {
  let payment = await razorpayService.fetchPayment(rzpPaymentId);

  const expectedPaise = toPaise(order.total_amount);
  if (payment.order_id !== rzpOrderId || payment.currency !== 'INR' || Number(payment.amount) !== expectedPaise) {
    throw fail(400, 'Payment does not match this order');
  }

  // Accounts set to manual capture leave the payment "authorized": capture it for the exact order amount
  if (payment.status === 'authorized') {
    payment = await razorpayService.capturePayment(rzpPaymentId, expectedPaise);
  }
  if (payment.status !== 'captured') throw fail(402, 'Payment has not been completed');

  const lateForCancelledOrder = order.order_status === 'cancelled';
  const restore = !lateForCancelledOrder || !order.delivery_date || order.delivery_date >= todayIst();

  const paidOrder = await orderModel.markPaidIfPending(order.id, {
    payment_ref: `razorpay:${rzpOrderId}:${rzpPaymentId}`,
    payment_method: methodLabel(payment.method, order.payment_method),
    order_status: restore ? 'placed' : 'cancelled'
  });

  // null: a parallel request already settled it, so the side effects below have already run once
  if (!paidOrder) return orderModel.findById(order.id);

  void notifyUser('payment_paid', { userId: paidOrder.buyer_id, order: paidOrder });
  if (restore) {
    await runOrderPlacedEffects(paidOrder, metaFromOrder(paidOrder));
    void notifyUser('order_placed', { userId: paidOrder.buyer_id, order: paidOrder });
    if (lateForCancelledOrder) console.warn(`[Payments] Late payment restored order ${paidOrder.order_number}`);
    return paidOrder;
  }

  console.warn(`[Payments] Late payment for cancelled order ${paidOrder.order_number} (delivery date passed): refund due`);
  return flagRefundDue(paidOrder, 'Payment arrived after the order was cancelled and its delivery date had passed');
};

/**
 * Asks Razorpay what happened to an online order that is still unpaid on our side.
 *   'paid'       a payment went through: the order is now settled
 *   'processing' an attempt is still in progress at the bank (e.g. a UPI approval): do not give up yet
 *   'unpaid'     nothing was paid
 */
export const checkWithRazorpay = async (order) => {
  const { rzpOrderId } = parsePaymentRef(order.payment_ref);
  if (!rzpOrderId) return { state: 'unpaid', order };

  const { items: attempts = [] } = await razorpayService.fetchOrderPayments(rzpOrderId);
  const successful = attempts.find((p) => p.status === 'captured' || p.status === 'authorized');
  if (successful) return { state: 'paid', order: await settlePayment(order, rzpOrderId, successful.id) };

  if (attempts.some((p) => p.status === 'created')) return { state: 'processing', order };
  return { state: 'unpaid', order };
};

// How far back to look for an earlier checkout of the same buyer that may still be paid (matches the reconciler)
const PREVIOUS_CHECKOUT_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Run before any new order (online or cash on delivery). Settles the buyer's earlier unfinished online checkouts with
 * Razorpay, so a shopper whose payment went through, but whose page never heard back, does not pay or order twice.
 * Returns null when it is safe to go ahead, otherwise { code, message, order? } to show the shopper.
 */
export const checkPreviousCheckouts = async (buyerId) => {
  const earlier = await orderModel.findAwaitingByBuyer(buyerId, new Date(Date.now() - PREVIOUS_CHECKOUT_WINDOW_MS));

  for (const order of earlier) {
    const outcome = await checkWithRazorpay(order);
    const amount = `₹${Number(order.total_amount).toLocaleString('en-IN')}`;

    if (outcome.state === 'paid' && outcome.order.payment_status === 'paid' && outcome.order.order_status !== 'cancelled') {
      return {
        code: 'PREVIOUS_PAYMENT_CONFIRMED',
        message: `Your earlier payment of ${amount} went through, and order ${order.order_number} is confirmed. Please check My Orders before ordering again.`,
        order: outcome.order
      };
    }
    if (outcome.state === 'processing') {
      return {
        code: 'PREVIOUS_PAYMENT_PROCESSING',
        message: `Your bank is still confirming your earlier payment of ${amount} (order ${order.order_number}). Please wait a few minutes before ordering again: if it goes through, that order is confirmed; if it fails, no money is taken.`
      };
    }
    // Nothing was paid for it: close it so it never lingers
    if (outcome.state === 'unpaid') await orderModel.cancelUnpaidOnline(order.id);
  }
  return null;
};

// Refunds are never sent from this server. The store issues them by hand in the Razorpay dashboard:
//   1. a paid online order is cancelled  -> refund_status 'due' + an alert to the admins (flagRefundDue)
//   2. the admin refunds it in Razorpay  -> the refund.processed webhook marks it refunded (applyRefundEvent), or the
//      admin clicks "Mark as refunded" when the webhook is not set up (markRefundedByHand)

/**
 * Flags a cancelled, paid online order as needing a refund and alerts the admins. Safe to call more than once: only the
 * first call flags it and alerts. Returns the latest order.
 */
export const flagRefundDue = async (order, reason) => {
  const { rzpPaymentId } = parsePaymentRef(order.payment_ref);
  if (order.payment_status !== 'paid' || !rzpPaymentId) return order;

  const flagged = await orderModel.markRefundDue(order.id);
  if (!flagged) return orderModel.findById(order.id);

  console.log(`[Payments] Refund due for order ${flagged.order_number} (${reason})`);
  void alertRefundDue(flagged, reason);
  return flagged;
};

const notifyRefunded = (order) => void notifyUser('payment_refunded', { userId: order.buyer_id, order });

/**
 * Applies a refund.processed / refund.failed webhook. Refunds are issued in the Razorpay dashboard, so the order is
 * found by the refunded payment. A full refund marks the order refunded; a partial one only records the amount.
 */
export const applyRefundEvent = async (eventName, refund, payment) => {
  if (!refund?.payment_id) return null;
  const order = await orderModel.findByRazorpayPaymentId(refund.payment_id);
  if (!order) {
    console.warn(`[Razorpay webhook] ${eventName} for a payment that is not one of our orders: ${refund.payment_id}`);
    return null;
  }

  if (eventName === 'refund.failed') {
    if (order.payment_status === 'refunded') return order;
    const updated = await orderModel.updatePayment(order.id, {
      refund_status: 'due',
      refund_id: refund.id,
      refund_error: `Razorpay could not complete refund ${refund.id}. Please issue it again from the dashboard.`
    });
    void alertRefundDue(updated, `Razorpay could not complete refund ${refund.id}: please issue it again`);
    return updated;
  }

  if (eventName !== 'refund.processed') return order;

  // How much of this payment has been refunded so far (all refunds together), as Razorpay counts it
  const paymentNow = payment?.amount_refunded !== undefined ? payment : await razorpayService.fetchPayment(refund.payment_id);
  const refundedPaise = Number(paymentNow?.amount_refunded ?? refund.amount ?? 0);
  const fields = { refund_id: refund.id, refund_amount: refundedPaise / 100, refunded_at: new Date().toISOString() };

  if (refundedPaise >= toPaise(order.total_amount)) {
    const refunded = await orderModel.markRefunded(order.id, fields);
    if (!refunded) return orderModel.findById(order.id);
    notifyRefunded(refunded);
    return refunded;
  }
  // Part of the money given back (for example, one damaged item): the order stays paid
  return orderModel.updatePayment(order.id, { ...fields, refund_status: 'partial', refund_error: null });
};

/**
 * Admin's "Mark as refunded", for when the refund was issued in the Razorpay dashboard but the webhook did not update
 * the order (not set up yet, or Razorpay could not reach the server). Returns the order, or null if already refunded.
 */
export const markRefundedByHand = async (order, refundId) => {
  const refunded = await orderModel.markRefunded(order.id, {
    refund_amount: order.refund_amount ?? order.total_amount,
    refunded_at: new Date().toISOString(),
    ...(refundId ? { refund_id: refundId } : {})
  });
  if (refunded) notifyRefunded(refunded);
  return refunded;
};
