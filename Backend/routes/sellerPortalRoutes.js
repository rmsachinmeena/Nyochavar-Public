import { sellerPortalController } from '../controllers/sellerPortalController.js';
import { requireSeller } from '../config/sellerAuth.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { upload } from '../services/cloudinaryService.js';

const router = createRouter();

// Reads the pictures of an upload (up to 8, 10 MB each, images only) and turns upload problems into readable answers
const readPictures = (req, res, next) => {
  upload.array('images', 8)(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'A picture is too large. The most allowed is 10 MB per picture.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'You can upload at most 8 pictures at a time.'
          : err.message || 'The pictures could not be read.';
    return res.status(400).json({ success: false, error: message });
  });
};

// Every route below is for a signed-in seller only, and only ever touches that seller's own data
router.use(requireSeller);

// Store settings
router.get('/profile', sellerPortalController.getProfile);
router.put('/profile', sellerPortalController.updateProfile);
router.post('/change-password', sellerPortalController.changePassword);

// Product pictures
router.post('/uploads', readPictures, sellerPortalController.uploadImages);

// Products
router.get('/products', sellerPortalController.listProducts);
router.post('/products', sellerPortalController.createProduct);
router.put('/products/:id', sellerPortalController.updateProduct);
router.patch('/products/:id/stock', sellerPortalController.updateStock);
router.delete('/products/:id', sellerPortalController.deleteProduct);

// Orders and earnings
router.get('/orders', sellerPortalController.listOrders);
router.patch('/orders/:id/status', sellerPortalController.updateOrderStatus);
router.get('/payouts', sellerPortalController.listPayouts);

export default router;
