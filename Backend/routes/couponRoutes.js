import { couponController } from '../controllers/couponController.js';
import { requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';

const router = createRouter();

// Public: Validate a coupon for checkout
// POST /api/coupons/validate { code, order_amount }
router.post('/validate', couponController.validateCoupon);

// Public: Get all active, unexpired coupons
// GET /api/coupons
router.get('/', couponController.getActiveCoupons);

// Admin: Get all coupons (active + inactive with usage stats)
// GET /api/coupons/admin
router.get('/admin', requireAdmin, couponController.getAllCouponsAdmin);

// Admin: Create a new coupon
// POST /api/coupons
router.post('/', requireAdmin, couponController.createCoupon);

// Admin: Update an existing coupon
// PUT /api/coupons/:id
router.put('/:id', requireAdmin, couponController.updateCoupon);

// Admin: Toggle active status
// PATCH /api/coupons/:id/toggle
router.patch('/:id/toggle', requireAdmin, couponController.toggleCouponStatus);

// Admin: Delete a coupon
// DELETE /api/coupons/:id
router.delete('/:id', requireAdmin, couponController.deleteCoupon);

export default router;
