import { supabase } from '../config/supabase.js';
import { orderModel } from '../models/orderModel.js';
import { razorpayService, RazorpayError } from '../services/razorpayService.js';
import { prepareOrder } from '../services/orderPricing.js';
import { notifyUser } from '../services/notificationService.js';
import {
  applyRefundEvent,
  checkPreviousCheckouts,
  checkWithRazorpay,
  parsePaymentRef,
  settlePayment,
  toPaise
} from '../services/paymentSettlement.js';

const publicOrder = (order) => ({
  id: order.id,
  order_number: order.order_number,
  subtotal: order.subtotal,
  delivery_fee: order.delivery_fee,
  discount_amount: order.discount_amount,
  total_amount: order.total_amount,
  payment_method: order.payment_method,
  payment_status: order.payment_status,
  order_status: order.order_status
});

// Loads the order and makes sure it belongs to the signed-in buyer. Same answer for "missing" and "someone else's".
const loadOwnedOrder = async (orderId, buyerId) => {
  const order = await orderModel.findById(orderId);
  return order && order.buyer_id === buyerId ? order : null;
};

const refuse = (res, error, fallbackMessage) => {
  const status = error?.status && error.status < 600 ? error.status : 500;
  // Razorpay's own error text stays in the server log; the customer gets a plain message
  const message = error instanceof RazorpayError ? fallbackMessage : error?.message || fallbackMessage;
  return res.status(status === 401 || status === 403 ? 502 : status).json({ success: false, message });
};

// Webhook events that mean "money arrived for this Razorpay order"
const PAYMENT_EVENTS = new Set(['payment.captured', 'payment.authorized', 'order.paid']);


export const paymentController = {
  // Public: lets the checkout page know whether online payment is available (and whether it is the test sandbox)
  getConfig: (req, res) => {
    res.status(200).json({ success: true, enabled: razorpayService.isConfigured(), mode: razorpayService.mode() });
  },

  // Step 1: validate the cart on the server, save the order as "awaiting payment", create the Razorpay order.
  createRazorpayOrder: async (req, res) => {
    try {
      if (!razorpayService.isConfigured()) {
        return res.status(503).json({ success: false, message: 'Online payment is not available right now. Please choose cash on delivery.' });
      }

      const prepared = await prepareOrder(req.body);
      if (!prepared.ok) return res.status(prepared.status).json({ success: false, message: prepared.message });

      const { orderData } = prepared;
      if (orderData.payment_method === 'COD') {
        return res.status(400).json({ success: false, message: 'This order is set to cash on delivery.' });
      }

      const amountPaise = toPaise(orderData.total_amount);
      if (amountPaise < 100) {
        return res.status(400).json({ success: false, message: 'The order total is too small to pay online.' });
      }

      // Never let a shopper pay twice: an earlier checkout may have been paid without the page hearing back
      const previous = await checkPreviousCheckouts(orderData.buyer_id);
      if (previous) {
        return res.status(409).json({ success: false, code: previous.code, message: previous.message, order: previous.order && publicOrder(previous.order) });
      }

      // Not an order to pack until Razorpay confirms the money: it becomes 'placed' in settlePayment
      const order = await orderModel.create({ ...orderData, order_status: 'awaiting_payment', payment_ref: 'razorpay:pending' });

      let rzpOrder;
      try {
        rzpOrder = await razorpayService.createOrder({
          amountPaise,
          receipt: order.order_number,
          notes: { order_id: String(order.id), order_number: order.order_number }
        });
        await orderModel.updatePayment(order.id, { payment_ref: `razorpay:${rzpOrder.id}` });
      } catch (error) {
        // Never leave a payable-looking order behind when the gateway call failed
        await orderModel.cancelUnpaidOnline(order.id).catch(() => {});
        throw error;
      }

      res.status(201).json({
        success: true,
        keyId: razorpayService.publicKeyId(),
        mode: razorpayService.mode(),
        razorpayOrderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        order: publicOrder(order)
      });
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      return refuse(res, error, 'We could not start the payment. Please try again.');
    }
  },

  // Step 2: the browser sends back what Razorpay Checkout returned. Nothing is trusted until the signature
  // matches and Razorpay itself confirms the payment for exactly this order and amount.
  verifyRazorpayPayment: async (req, res) => {
    try {
      const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      const order = await loadOwnedOrder(order_id, req.auth.id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

      const { rzpOrderId, rzpPaymentId } = parsePaymentRef(order.payment_ref);
      if (!rzpOrderId || rzpOrderId !== razorpay_order_id) {
        return res.status(400).json({ success: false, message: 'This payment does not belong to this order.' });
      }

      // Already settled (e.g. the webhook was faster, or the page retried): answer the same, never charge or count twice
      if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
        if (rzpPaymentId && rzpPaymentId !== razorpay_payment_id) {
          return res.status(409).json({ success: false, message: 'This order is already paid.' });
        }
        return res.status(200).json({ success: true, order: publicOrder(order) });
      }

      const signatureOk = razorpayService.verifySignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
      });
      if (!signatureOk) {
        console.warn(`Razorpay signature mismatch for order ${order.order_number}`);
        return res.status(400).json({ success: false, message: 'Payment verification failed.' });
      }

      const paidOrder = await settlePayment(order, razorpay_order_id, razorpay_payment_id);
      res.status(200).json({ success: true, order: publicOrder(paidOrder) });
    } catch (error) {
      console.error('Error verifying Razorpay payment:', error);
      return refuse(
        res,
        error,
        'We could not confirm your payment yet. If money was deducted, your order will be confirmed in My Orders within a few minutes, or refunded in full.'
      );
    }
  },

  // The customer closed the payment window. If they did pay (verify never arrived) the order is confirmed; if the bank
  // is still confirming an attempt the order is left waiting (the webhook / reconciler finish it); otherwise the unpaid
  // order is cancelled so it never reaches fulfilment.
  abandonRazorpayPayment: async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.body.order_id, req.auth.id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

      if (order.payment_status === 'paid') {
        return res.status(200).json({ success: true, paid: true, order: publicOrder(order) });
      }

      const { rzpOrderId } = parsePaymentRef(order.payment_ref);
      if (!rzpOrderId || order.payment_status !== 'pending') {
        return res.status(200).json({ success: true, paid: false });
      }

      const outcome = await checkWithRazorpay(order);
      if (outcome.state === 'paid') {
        const paid = outcome.order.payment_status === 'paid' && outcome.order.order_status !== 'cancelled';
        return res.status(200).json({ success: true, paid, order: publicOrder(outcome.order) });
      }
      if (outcome.state === 'processing') {
        return res.status(200).json({ success: true, paid: false, processing: true, order: publicOrder(order) });
      }

      const cancelled = await orderModel.cancelUnpaidOnline(order.id);
      if (cancelled) void notifyUser('payment_failed', { userId: order.buyer_id, order });
      res.status(200).json({ success: true, paid: false });
    } catch (error) {
      console.error('Error closing Razorpay payment:', error);
      return refuse(res, error, 'Could not update the payment status.');
    }
  },

  // Razorpay's servers call this (Dashboard > Webhooks). The body is the raw bytes: the signature covers them exactly.
  // Answers 2xx for anything that will never succeed (bad data, unknown order) so Razorpay does not retry it forever,
  // and 5xx only for temporary problems, which Razorpay retries for up to 24 hours.
  razorpayWebhook: async (req, res) => {
    if (!razorpayService.verifyWebhookSignature(req.body, req.get('x-razorpay-signature'))) {
      return res.status(400).json({ success: false });
    }

    let event;
    try {
      event = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).json({ success: false });
    }

    // The same event can arrive twice: remember each event id. Every handler below is safe to repeat anyway, so a
    // database problem here is logged and the event is still processed.
    const eventId = req.get('x-razorpay-event-id');
    if (eventId) {
      const { error } = await supabase.from('razorpay_events').insert({ event_id: eventId, event: event.event });
      if (error?.code === '23505') return res.status(200).json({ success: true, duplicate: true });
      if (error) console.warn('[Razorpay webhook] could not record event id:', error.message);
    }

    try {
      const payment = event.payload?.payment?.entity;

      if (PAYMENT_EVENTS.has(event.event) && payment?.order_id) {
        const order = await orderModel.findByRazorpayOrderId(payment.order_id);
        if (!order) {
          console.warn(`[Razorpay webhook] ${event.event} for unknown order ${payment.order_id}`);
        } else if (order.payment_status !== 'paid' && order.payment_status !== 'refunded') {
          await settlePayment(order, payment.order_id, payment.id);
        }
      } else if (event.event === 'refund.processed' || event.event === 'refund.failed') {
        const refund = event.payload?.refund?.entity;
        if (refund?.id) await applyRefundEvent(event.event, refund, payment);
      } else if (event.event === 'payment.failed' && payment) {
        console.warn(`[Razorpay webhook] Payment failed for ${payment.order_id}: ${payment.error_description || payment.error_code || 'no reason'}`);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      if (error?.status === 400 || error?.status === 402) {
        // The payment does not match the order, or is not complete: retrying will not change that
        console.error(`[Razorpay webhook] ${event.event} needs a manual look:`, error.message);
        return res.status(200).json({ success: true });
      }
      console.error(`[Razorpay webhook] ${event.event} failed, Razorpay will retry:`, error);
      if (eventId) await supabase.from('razorpay_events').delete().eq('event_id', eventId);
      return res.status(500).json({ success: false });
    }
  }
};
