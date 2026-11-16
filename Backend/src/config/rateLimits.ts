export interface RateLimitRule {
  /** Max requests allowed inside the window before the caller is blocked. */
  limit: number;
  /** Length of the counting window. */
  windowMs: number;
  /** How long the caller stays blocked after exceeding the limit. */
  blockMs: number;
}

export const DEFAULT_RULE: RateLimitRule = {
  limit: 35,
  windowMs: 60_000,
  blockMs: 60_000,
};

/**
 * Per-endpoint overrides. Key format: `METHOD /full/route/pattern` (no trailing slash,
 * route params kept as written, e.g. `GET /api/products/:id`).
 *
 * Every other endpoint uses DEFAULT_RULE: more than 35 hits in a minute => blocked for 60s.
 */
export const RATE_LIMIT_OVERRIDES: Record<string, Partial<RateLimitRule>> = {
  // Storefront analytics beacon fires on nearly every interaction; 10/min would drop real events.
  'POST /api/events': { limit: 120 },
  // HTTP fallback of the 5-second socket token check (only used when a socket cannot connect)
  'GET /api/auth/check': { limit: 60 },
  // Razorpay delivers every store's webhooks from a handful of addresses; bursts must not be blocked
  'POST /api/payments/razorpay/webhook': { limit: 300 },
  // Password reset and email codes: 10 tries a minute per IP (the app also sends a shopper away after 10 attempts)
  'POST /api/auth/forgot-password': { limit: 10 },
  'POST /api/auth/reset-password': { limit: 10 },
  'POST /api/auth/verify': { limit: 10 },
  'POST /api/auth/resend': { limit: 10 },
  // Shopper login: 15 tries a minute per IP (on top of the 5-wrong-passwords lock per email)
  'POST /api/auth/login': { limit: 15 },
  // Seller sign-in: looking an account up, signing in, registering and the reset code are all kept tight
  'POST /api/seller/auth/identify': { limit: 10, windowMs: 60_000, blockMs: 60_000 },
  'POST /api/seller/auth/login': { limit: 15 },
  'POST /api/seller/auth/register': { limit: 10 },
  'POST /api/seller/auth/forgot-password': { limit: 5, windowMs: 60_000, blockMs: 5 * 60_000 },
  'POST /api/seller/auth/reset-password': { limit: 10 },
  // Opening a seller's panel needs the master password: few tries, long block
  'POST /api/admin/sellers/:id/open-panel': { limit: 5, windowMs: 60_000, blockMs: 10 * 60_000 },
  // Seller product pictures: each picture is one request, so a product with 8 pictures needs room to upload them all
  'POST /api/seller/uploads': { limit: 40 },
  // Forgot password by mobile number (WhatsApp code): 10 tries a minute per IP, then blocked for 60 seconds
  'POST /api/auth/phone/forgot-password': { limit: 10, windowMs: 60_000, blockMs: 60_000 },
  'POST /api/auth/phone/reset-password': { limit: 10, windowMs: 60_000, blockMs: 60_000 },
  // Sign-in step 1 tells the caller whether an account exists (and sends a code): 10 tries, then blocked for 60 seconds
  'POST /api/auth/identify': { limit: 10, windowMs: 60_000, blockMs: 60_000 },
  'POST /api/auth/identify/verify': { limit: 10, windowMs: 60_000, blockMs: 60_000 },
  // Tells the caller whether an account exists, so keep it tight to stop address enumeration: 5/min, then 10 min block.
  'POST /api/auth/check-email': { limit: 5, windowMs: 60_000, blockMs: 10 * 60_000 },
  // Payments: creating a Razorpay order writes to the database and calls Razorpay, so keep it tight.
  // Mail server route (called by the main backend): an admin broadcast makes one call per recipient. The shared secret is the real lock.
  'POST /api/internal/send-email': { limit: 300 },
  'POST /api/payments/razorpay/order': { limit: 10 },
  'POST /api/payments/razorpay/verify': { limit: 20 },
  'POST /api/payments/razorpay/abandon': { limit: 20 },
};

