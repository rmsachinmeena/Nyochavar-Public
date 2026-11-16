import { paymentController } from '../controllers/paymentController.js';
import { requireBuyer } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { validateBody } from '../src/middlewares/validate.js';
import { abandonRazorpaySchema, verifyRazorpaySchema } from '../src/validators/payments.js';

const router = createRouter();

// The order owner is always the signed-in buyer: never trust ids sent in the body
const stampBuyer = (req, res, next) => {
  req.body = { ...req.body, buyer_id: req.auth.id, user_id: req.auth.id };
  next();
};

// Public: is online payment available (and is it the test sandbox)?
router.get('/config', paymentController.getConfig);

// Razorpay (signed-in buyers only)
router.post('/razorpay/order', requireBuyer, stampBuyer, paymentController.createRazorpayOrder);
router.post('/razorpay/verify', requireBuyer, validateBody(verifyRazorpaySchema), paymentController.verifyRazorpayPayment);
router.post('/razorpay/abandon', requireBuyer, validateBody(abandonRazorpaySchema), paymentController.abandonRazorpayPayment);

export default router;

// Razorpay's servers (no login: the signature proves the sender). Mounted on its own in server.js, BEFORE the JSON
// parser, because the signature is computed over the raw body.
export const razorpayWebhookRouter = createRouter();
razorpayWebhookRouter.post('/', paymentController.razorpayWebhook);
