import { sellerAuthController } from '../controllers/sellerAuthController.js';
import { requireSeller } from '../config/sellerAuth.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';

// createRouter adds the request-rate limits (see src/config/rateLimits.ts)
const router = createRouter();

// Identification & Login
router.post('/identify', sellerAuthController.identify);
router.post('/login', sellerAuthController.login);

// Onboarding / Registration
router.post('/register', sellerAuthController.register);

// Password Reset
router.post('/forgot-password', sellerAuthController.sendResetCode);
router.post('/reset-password', sellerAuthController.resetPassword);

// Profile of the signed-in seller
router.get('/me', requireSeller, sellerAuthController.getMe);

export default router;
