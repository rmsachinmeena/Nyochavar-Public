import { request } from './apiClient';

// ---------------------------------------------------------------------------
// Razorpay Standard Checkout. The secret key never reaches the browser: the server creates the order, the browser
// opens Razorpay's own payment window, and the server verifies the result before an order counts as paid.
// ---------------------------------------------------------------------------

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: { description?: string; reason?: string; code?: string };
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  method?: Record<string, boolean>;
  retry?: { enabled: boolean };
  modal?: { ondismiss?: () => void; confirm_close?: boolean; escape?: boolean };
  handler: (response: RazorpaySuccess) => void;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayFailure) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export interface PaymentConfig {
  enabled: boolean;
  mode: 'test' | 'live';
}

export interface RazorpaySession {
  keyId: string;
  mode: 'test' | 'live';
  razorpayOrderId: string;
  amount: number;
  currency: string;
  order: { id: string; order_number: string; total_amount: number; [key: string]: any };
}

export interface SettledOrder {
  id: string;
  order_number: string;
  subtotal?: number;
  delivery_fee?: number;
  discount_amount?: number;
  total_amount: number;
  payment_status?: string;
  [key: string]: any;
}

/** Thrown when the customer closes the payment window without paying. */
export class PaymentCancelledError extends Error {
  constructor() {
    super('Payment was cancelled');
    this.name = 'PaymentCancelledError';
  }
}

let scriptPromise: Promise<void> | null = null;

const loadCheckoutScript = (): Promise<void> => {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a retry after a network failure
      script.remove();
      reject(new Error('Could not load the secure payment window. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
};

export const paymentService = {
  /** Is online payment available (and is it the Razorpay test sandbox)? */
  getConfig: async (): Promise<PaymentConfig> => {
    const data = await request('/payments/config', { fallbackMessage: 'Could not load payment options' });
    return { enabled: Boolean(data.enabled), mode: data.mode === 'live' ? 'live' : 'test' };
  },

  /** The server re-prices the cart, saves the order as "payment pending" and creates the Razorpay order. */
  createOrder: (orderPayload: Record<string, unknown>): Promise<RazorpaySession> =>
    request('/payments/razorpay/order', {
      method: 'POST',
      role: 'buyer',
      body: orderPayload,
      fallbackMessage: 'We could not start the payment. Please try again.',
    }),

  /** Sends Razorpay's signed result to the server, which verifies it with Razorpay before marking the order paid. */
  verify: async (orderId: string, result: RazorpaySuccess): Promise<SettledOrder> => {
    const data = await request('/payments/razorpay/verify', {
      method: 'POST',
      role: 'buyer',
      body: { order_id: orderId, ...result },
      fallbackMessage: 'We could not confirm your payment.',
    });
    return data.order;
  },

  /**
   * The payment window was closed: the server confirms the order if money did move, leaves it waiting when the bank is
   * still confirming an attempt (`processing`, e.g. a UPI approval), and otherwise cancels it.
   */
  abandon: async (orderId: string): Promise<{ paid: boolean; processing: boolean; order?: SettledOrder }> => {
    const data = await request('/payments/razorpay/abandon', {
      method: 'POST',
      role: 'buyer',
      body: { order_id: orderId },
      fallbackMessage: 'Could not update the payment status.',
    });
    return { paid: Boolean(data.paid), processing: Boolean(data.processing), order: data.order };
  },

  /**
   * Opens Razorpay's payment window. Resolves with the signed result, rejects with PaymentCancelledError when
   * the customer closes the window. `onAttemptFailed` fires for each failed attempt (the customer can retry inside).
   */
  openCheckout: async (params: {
    session: RazorpaySession;
    description: string;
    method: 'upi' | 'card';
    prefill: { name?: string; email?: string; contact?: string };
    onAttemptFailed?: (message: string) => void;
  }): Promise<RazorpaySuccess> => {
    await loadCheckoutScript();
    if (!window.Razorpay) throw new Error('The secure payment window is not available. Please try again.');

    const { session, description, prefill, onAttemptFailed } = params;

    return new Promise<RazorpaySuccess>((resolve, reject) => {
      const checkout = new window.Razorpay!({
        key: session.keyId,
        amount: session.amount,
        currency: session.currency,
        name: 'Nyochavar',
        description,
        order_id: session.razorpayOrderId,
        prefill,
        notes: { order_number: session.order.order_number },
        theme: { color: '#0052FF' },
        // No method restriction: Razorpay shows every method enabled on the account (restricting to one failed with
        // "No appropriate payment method found" when that method is not enabled for the account)
        retry: { enabled: true },
        modal: { confirm_close: true, ondismiss: () => reject(new PaymentCancelledError()) },
        handler: (response) => resolve(response),
      });

      checkout.on('payment.failed', (response) => {
        onAttemptFailed?.(response.error?.description || 'The payment did not go through. You can try again.');
      });
      checkout.open();
    });
  },
};
