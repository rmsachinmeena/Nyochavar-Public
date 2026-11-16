import { orderModel } from '../models/orderModel.js';
import { razorpayService } from './razorpayService.js';
import { checkWithRazorpay } from './paymentSettlement.js';

// Online orders can be left "awaiting payment" when the shopper's tab closes, the phone dies, or a UPI approval is
// still with the bank when the window closes. Every few minutes this asks Razorpay about each of them: paid orders are
// confirmed, abandoned ones cancelled. It works even without the webhook, and is harmless next to it (every step is a
// conditional update, so whoever is first wins and the others do nothing).

const SWEEP_EVERY_MS = 5 * 60 * 1000;
// Give the shopper time to finish paying before an order is looked at at all
const MIN_AGE_MS = 15 * 60 * 1000;
// A bank attempt still "in progress" after this long is treated as abandoned (UPI requests expire well before)
const GIVE_UP_AFTER_MS = 2 * 60 * 60 * 1000;

let running = false;

export const reconcileAwaitingPayments = async () => {
  if (running || !razorpayService.isConfigured()) return;
  running = true;
  try {
    const orders = await orderModel.findAwaitingPayment(new Date(Date.now() - MIN_AGE_MS));
    for (const order of orders) {
      try {
        const outcome = await checkWithRazorpay(order);
        const age = Date.now() - new Date(order.created_at).getTime();
        if (outcome.state === 'unpaid' || (outcome.state === 'processing' && age > GIVE_UP_AFTER_MS)) {
          await orderModel.cancelUnpaidOnline(order.id);
        }
        if (outcome.state === 'paid') console.log(`[Payments] Reconciler confirmed payment for ${order.order_number}`);
      } catch (error) {
        // One bad order (or a Razorpay hiccup) must not stop the rest; it is retried on the next sweep
        console.warn(`[Payments] Reconciler skipped ${order.order_number}:`, error.message);
      }
    }
  } catch (error) {
    console.warn('[Payments] Reconciler run failed:', error.message);
  } finally {
    running = false;
  }
};

export const startPaymentReconciler = () => {
  const timer = setInterval(() => void reconcileAwaitingPayments(), SWEEP_EVERY_MS);
  timer.unref();
};
