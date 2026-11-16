import { requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { upload, uploadToCloudinary } from '../services/cloudinaryService.js';

const router = createRouter();

/**
 * POST /api/upload/single
 * Uploads a single image to Cloudinary folder "GIFT_APPLICATION"
 */
router.post('/single', requireAdmin, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum allowed size is 10MB.'
        });
      }
      return res.status(400).json({ success: false, message: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const customName = req.body.name || req.body.title || file.originalname.split('.')[0];
    const cleanPrefix = customName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const publicId = `${cleanPrefix}_${Date.now()}`;

    const result = await uploadToCloudinary(file.buffer, {
      public_id: publicId
    });

    console.log(`☁️ [Cloudinary Uploaded] -> ${result.secure_url}`);

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully to GIFT_APPLICATION',
      url: result.secure_url,
      secure_url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes
    });
  } catch (error) {
    console.error('Error in /upload/single:', error);
    const msg = error.message || error;
    const isSizeError = typeof msg === 'string' && msg.includes('File size too large');
    return res.status(isSizeError ? 400 : 500).json({
      success: false,
      message: isSizeError ? 'Image exceeds Cloudinary 10MB limit. Please upload a smaller image.' : 'Failed to upload image to Cloudinary',
      error: msg
    });
  }
});

/**
 * POST /api/upload/multiple
 * Uploads multiple images (up to 10) to Cloudinary folder "GIFT_APPLICATION"
 */
router.post('/multiple', requireAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files uploaded' });
    }

    const uploadPromises = files.map((file, idx) => {
      const original = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);
      const publicId = `${original}_${Date.now()}_${idx}`;
      return uploadToCloudinary(file.buffer, { public_id: publicId });
    });

    const results = await Promise.all(uploadPromises);
    const urls = results.map(r => r.secure_url);

    return res.status(200).json({
      success: true,
      message: `${results.length} images uploaded successfully to GIFT_APPLICATION`,
      urls,
      results: results.map(r => ({
        url: r.secure_url,
        public_id: r.public_id,
        bytes: r.bytes
      }))
    });
  } catch (error) {
    console.error('Error in /upload/multiple:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload images to Cloudinary',
      error: error.message || error
    });
  }
});

export default router;
