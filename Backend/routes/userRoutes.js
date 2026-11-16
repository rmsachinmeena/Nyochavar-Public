import { userController } from '../controllers/userController.js';
import { requireAdmin, requireAuth, requireBuyerSelf, requireSelfOrAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { bulkIdsSchema, validateBody } from '../src/middlewares/validate.js';

const router = createRouter();

// List all users for admin directory / search
router.get('/', requireAdmin, userController.getAllUsers);
// Delete one or many customer accounts (superadmin)
router.post('/bulk-delete', requireAdmin, validateBody(bulkIdsSchema), userController.bulkDeleteUsers);

// Profile Details & Edit (owner or admin)
router.get('/profile/:id', requireSelfOrAdmin('id'), userController.getProfile);
router.put('/profile/:id', requireSelfOrAdmin('id'), userController.updateProfile);

// Multiple Addresses Management
router.get('/addresses/:userId', requireSelfOrAdmin('userId'), userController.getAddresses);
router.post('/addresses/:userId', requireSelfOrAdmin('userId'), userController.addAddress);
router.put('/addresses/:userId/:addressId', requireSelfOrAdmin('userId'), userController.updateAddress);
router.delete('/addresses/:userId/:addressId', requireSelfOrAdmin('userId'), userController.deleteAddress);
router.put('/addresses/:userId/:addressId/default', requireSelfOrAdmin('userId'), userController.setDefaultAddress);

// Password Change & Set: only the account owner, never an admin
router.put('/change-password/:id', requireBuyerSelf('id'), userController.changePassword);
router.put('/set-password/:id', requireBuyerSelf('id'), userController.setPassword);

// Orders
router.get('/orders/:userId', requireSelfOrAdmin('userId'), userController.getOrders);

// Wishlist
router.get('/wishlist/:userId', requireSelfOrAdmin('userId'), userController.getWishlist);
router.post('/wishlist/:userId', requireSelfOrAdmin('userId'), userController.addToWishlist);
router.delete('/wishlist/:userId/:productId', requireSelfOrAdmin('userId'), userController.removeFromWishlist);

// Notifications (:id below is a notification id, so only a valid login is enforced here)
router.get('/notifications/:userId', requireSelfOrAdmin('userId'), userController.getNotifications);
router.put('/notifications/:userId/read-all', requireSelfOrAdmin('userId'), userController.markAllNotificationsRead);
router.put('/notifications/:id/read', requireAuth, userController.markNotificationRead);
router.delete('/notifications/:id', requireAuth, userController.hideNotification);

// Cart
router.get('/cart/:userId', requireSelfOrAdmin('userId'), userController.getCart);

// Newsletter Subscribers (Public Subscribe, Admin List)
router.post('/newsletter/subscribe', userController.subscribeNewsletter);
router.get('/newsletter/subscribers', requireAdmin, userController.getSubscribers);

export default router;
