import { riderController } from '../controllers/riderController.js';
import { requireRider, requireRiderSelf } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';

const router = createRouter();

// Rider Authentication (session refresh/logout live under /api/auth/rider/* so the cookie path matches)
router.post('/login', riderController.login);

// Rider Assigned Orders: only the rider themselves
router.get('/orders/:riderId', requireRiderSelf('riderId'), riderController.getMyOrders);

// Lifecycle actions by Rider (ownership of the order is checked in the controller)
router.put('/orders/:orderId/out-for-delivery', requireRider, riderController.markOutForDelivery);
router.post('/orders/:orderId/verify-otp', requireRider, riderController.verifyDeliveryOtp);
router.put('/orders/:orderId/delivery-issue', requireRider, riderController.reportDeliveryIssue);
router.put('/duty-status', requireRider, riderController.updateDutyStatus);

export default router;
