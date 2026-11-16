import { bannerController } from '../controllers/bannerController.js';
import { requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { bulkIdsSchema, validateBody } from '../src/middlewares/validate.js';

const router = createRouter();

// Public storefront reads
// GET /api/banners (supports ?active=true)
router.get('/', bannerController.getBanners);

// GET /api/banners/:id
router.get('/:id', bannerController.getBannerById);

// Admin writes
// POST /api/banners
router.post('/', requireAdmin, bannerController.createBanner);

// PUT /api/banners/:id
router.put('/:id', requireAdmin, bannerController.updateBanner);

// PATCH /api/banners/:id/toggle
router.patch('/:id/toggle', requireAdmin, bannerController.toggleBannerStatus);

// DELETE /api/banners/:id
router.delete('/:id', requireAdmin, bannerController.deleteBanner);

// POST /api/banners/bulk-delete { ids } (delete one or many)
router.post('/bulk-delete', requireAdmin, validateBody(bulkIdsSchema), bannerController.bulkDeleteBanners);

export default router;
