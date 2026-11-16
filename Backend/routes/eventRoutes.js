import { eventController } from '../controllers/eventController.js';
import { optionalAuth, requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { bulkIdsSchema, validateBody } from '../src/middlewares/validate.js';

const router = createRouter();

// Non-blocking buyer event tracking ingestion (anonymous visitors are tracked too, optional auth attaches verified user_id)
router.post('/', optionalAuth, eventController.trackEvent);

// Link anonymous guest events of a session to an authenticated user upon sign-in/order
router.post('/stitch', optionalAuth, eventController.stitchSession);

// SuperAdmin analytics endpoints
router.get('/overview', requireAdmin, eventController.getOverview);
router.get('/users', requireAdmin, eventController.getUsersWithSummary);
router.get('/users/:userId/summary', requireAdmin, eventController.getUserSummary);
router.get('/users/:userId/timeline', requireAdmin, eventController.getUserTimeline);
router.post('/bulk-delete', requireAdmin, validateBody(bulkIdsSchema), eventController.bulkDeleteEvents);

export default router;
