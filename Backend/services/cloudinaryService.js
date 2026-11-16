import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use in-memory buffer storage with Multer for fast streaming directly to Cloudinary
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit (Cloudinary max standard limit)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

/**
 * Upload a file buffer to Cloudinary in the "GIFT_APPLICATION" folder
 * @param {Buffer} fileBuffer 
 * @param {Object} options 
 * @returns {Promise<Object>} Cloudinary upload result
 */
export const uploadToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const cleanPublicId = options.public_id 
      ? options.public_id.replace(/[^a-zA-Z0-9_-]/g, '_')
      : `gift_img_${timestamp}`;

    const uploadOptions = {
      folder: 'GIFT_APPLICATION',
      public_id: cleanPublicId,
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto',
      ...options
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('Cloudinary stream upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    stream.end(fileBuffer);
  });
};

export default {
  cloudinary,
  upload,
  uploadToCloudinary
};
