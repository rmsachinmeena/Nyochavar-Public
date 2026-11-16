import { adminSellerController } from '../controllers/adminSellerController.js';
import { requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';

// Superadmin only: everything about sellers
const router = createRouter();
router.use(requireAdmin);

router.get('/', adminSellerController.list);
router.get('/:id', adminSellerController.get);
router.put('/:id', adminSellerController.update);
router.patch('/:id/status', adminSellerController.setStatus);
router.patch('/:id/commission', adminSellerController.setCommission);
router.post('/:id/reset-password', adminSellerController.resetPassword);
router.post('/:id/open-panel', adminSellerController.openPanel);
router.delete('/:id', adminSellerController.remove);

export default router;
