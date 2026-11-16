import { createHmac, timingSafeEqual } from 'node:crypto';

// Thin Razorpay REST client (no SDK needed). The key SECRET is read from the server environment only and is never
// logged, returned to the browser or stored: the browser only ever receives the public key id.
const API_BASE = 'https://api.razorpay.com/v1';
const REQUEST_TIMEOUT_MS = 15_000;

const keyId = () => (process.env.RAZORPAY_KEY_ID || '').trim();
const keySecret = () => (process.env.RAZORPAY_KEY_SECRET || '').trim();
// Set in Razorpay Dashboard > Webhooks; different from the key secret. Without it the webhook endpoint refuses everything.
const webhookSecret = () => (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();

// Constant-time comparison of two hex signatures
const sameSignature = (expectedHex, given) => {
  const a = Buffer.from(expectedHex, 'utf8');
  const b = Buffer.from(String(given || ''), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};

export class RazorpayError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'RazorpayError';
    this.status = status;
    this.code = code;
  }
}

const call = async (method, path, body) => {
  if (!keyId() || !keySecret()) throw new RazorpayError('Razorpay is not configured', 503, 'NOT_CONFIGURED');

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    throw new RazorpayError('Could not reach Razorpay', 502, 'NETWORK');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Razorpay's description is safe to log (it never echoes credentials)
    console.error(`Razorpay ${method} ${path} failed (${res.status}):`, data?.error?.description || data?.error?.code || 'unknown');
    throw new RazorpayError(data?.error?.description || 'Razorpay request failed', res.status, data?.error?.code);
  }
  return data;
};

export const razorpayService = {
  isConfigured: () => Boolean(keyId() && keySecret()),
  mode: () => (keyId().startsWith('rzp_live_') ? 'live' : 'test'),
  publicKeyId: () => keyId(),

  /** amountPaise is the amount in the smallest unit (₹499.00 => 49900) */
  createOrder: ({ amountPaise, receipt, notes }) =>
    call('POST', '/orders', { amount: amountPaise, currency: 'INR', receipt, notes }),

  fetchPayment: (paymentId) => call('GET', `/payments/${encodeURIComponent(paymentId)}`),

  capturePayment: (paymentId, amountPaise) =>
    call('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: 'INR' }),

  fetchOrderPayments: (orderId) => call('GET', `/orders/${encodeURIComponent(orderId)}/payments`),

  /**
   * Checks the signature Razorpay Checkout returns: HMAC-SHA256 of "<razorpay_order_id>|<razorpay_payment_id>"
   * with the key secret. A forged payment cannot produce a valid signature without the secret.
   */
  verifySignature: ({ orderId, paymentId, signature }) => {
    if (!keySecret() || !orderId || !paymentId || !signature) return false;
    return sameSignature(createHmac('sha256', keySecret()).update(`${orderId}|${paymentId}`).digest('hex'), signature);
  },

  webhookEnabled: () => Boolean(webhookSecret()),

  /** Webhook: HMAC-SHA256 of the raw request body with the webhook secret, sent in X-Razorpay-Signature. */
  verifyWebhookSignature: (rawBody, signature) => {
    if (!webhookSecret() || !Buffer.isBuffer(rawBody) || !signature) return false;
    return sameSignature(createHmac('sha256', webhookSecret()).update(rawBody).digest('hex'), signature);
  }
};
