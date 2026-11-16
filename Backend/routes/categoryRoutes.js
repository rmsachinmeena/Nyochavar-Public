import { categoryController } from '../controllers/categoryController.js';
import { requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { bulkIdsSchema, validateBody } from '../src/middlewares/validate.js';

const router = createRouter();

// Public storefront reads
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);

// Admin writes
router.post('/', requireAdmin, categoryController.createCategory);
router.put('/:id', requireAdmin, categoryController.updateCategory);
router.delete('/:id', requireAdmin, categoryController.deleteCategory);
router.post('/bulk-delete', requireAdmin, validateBody(bulkIdsSchema), categoryController.bulkDeleteCategories);

export default router;
