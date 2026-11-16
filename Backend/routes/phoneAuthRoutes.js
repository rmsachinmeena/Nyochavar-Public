import { createRouter } from '../src/middlewares/rateLimiter.js';
import { phoneAuthController } from '../controllers/phoneAuthController.js';
import { authenticate } from '../src/middlewares/authenticate.js';

const router = createRouter();

// Optional authentication middleware: if bearer token exists, extract user
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return next();
  return authenticate('buyer', 'superadmin', 'rider')(req, res, () => next());
};

// Public endpoints for phone verification
router.get('/settings', phoneAuthController.getPublicSettings);
router.get('/status', optionalAuth, phoneAuthController.getStatus);
router.post('/send-otp', optionalAuth, phoneAuthController.sendOtp);
router.post('/verify-otp', optionalAuth, phoneAuthController.verifyOtp);
router.post('/forgot-password', phoneAuthController.forgotPassword);
router.post('/reset-password', phoneAuthController.resetPassword);
router.post('/complete-signup', phoneAuthController.completePhoneSignup);
router.post('/verify-firebase', optionalAuth, phoneAuthController.verifyFirebase);

export default router;

