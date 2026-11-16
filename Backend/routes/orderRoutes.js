import { orderController } from '../controllers/orderController.js';
import { requireAdmin, requireAuth, requireBuyer, requireSelfOrAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { bulkIdsSchema, validateBody } from '../src/middlewares/validate.js';

const router = createRouter();

// The order owner is always the signed-in buyer: never trust ids sent in the body
const stampBuyer = (req, res, next) => {
  req.body = { ...req.body, buyer_id: req.auth.id, user_id: req.auth.id };
  next();
};

// Admin: full order list
router.get('/', requireAdmin, orderController.getAllOrders);

// Buyer: place an order
router.post('/', requireBuyer, stampBuyer, orderController.createOrder);

// Buyer (own orders) or admin
router.get('/user/:buyerId', requireSelfOrAdmin('buyerId'), orderController.getBuyerOrders);
router.get('/:id', requireAuth, orderController.getOrderById);

// Admin: lifecycle management
router.put('/:id/cancel', requireBuyer, orderController.cancelMyOrder);
router.put('/:id/status', requireAdmin, orderController.updateOrderStatus);
router.put('/:id/assign-rider', requireAdmin, orderController.assignRider);
router.post('/:id/mark-refunded', requireAdmin, orderController.markRefunded);
router.post('/bulk-delete', requireAdmin, validateBody(bulkIdsSchema), orderController.bulkDeleteOrders);

export default router;
