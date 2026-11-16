import { createRouter } from '../src/middlewares/rateLimiter.js';
import { getProductReviews, createReview, getPendingReview, createOrderReview } from '../controllers/reviewController.js';
import { requireAdmin, requireBuyer } from '../src/middlewares/authenticate.js';

const router = createRouter();

// Customer: the delivered order that waits for a review, and sending that review
router.get('/mine/pending', requireBuyer, getPendingReview);
router.post('/order/:orderId', requireBuyer, createOrderReview);

// Public route to fetch reviews for a product
router.get('/:productId', getProductReviews);

// Admin route to create a review manually
router.post('/', requireAdmin, createReview);

export default router;
