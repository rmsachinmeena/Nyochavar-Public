import { productController } from '../controllers/productController.js';
import { requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { bulkIdsSchema, validateBody } from '../src/middlewares/validate.js';

const router = createRouter();

// Public storefront reads
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Admin writes
router.post('/', requireAdmin, productController.createProduct);
router.put('/:id', requireAdmin, productController.updateProduct);
router.patch('/:id/stock', requireAdmin, productController.updateStock);
router.patch('/:id/toggle', requireAdmin, productController.toggleProductStatus);
router.delete('/:id', requireAdmin, productController.deleteProduct);
router.post('/bulk-delete', requireAdmin, validateBody(bulkIdsSchema), productController.bulkDeleteProducts);

export default router;
