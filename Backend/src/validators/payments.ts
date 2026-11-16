import { z } from 'zod';

// Razorpay ids are short alphanumeric strings: order_XXXX / pay_XXXX. Anything else is rejected before it can reach the API.
const razorpayOrderId = z.string().regex(/^order_[A-Za-z0-9]{6,40}$/, 'Invalid payment order');
const razorpayPaymentId = z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/, 'Invalid payment id');
const orderId = z.string().trim().min(1).max(64);

export const verifyRazorpaySchema = z.object({
  order_id: orderId,
  razorpay_order_id: razorpayOrderId,
  razorpay_payment_id: razorpayPaymentId,
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid payment signature'),
});

export const abandonRazorpaySchema = z.object({
  order_id: orderId,
});
