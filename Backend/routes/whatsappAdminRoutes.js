import { whatsappController } from '../controllers/whatsappController.js';
import { upload } from '../services/cloudinaryService.js';
import { requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { validateBody } from '../src/middlewares/validate.js';
import { createWhatsappLinkSchema, createWhatsappTemplateSchema, updateWhatsappTemplateSchema } from '../src/validators/whatsapp.js';

const router = createRouter();

// Superadmin only: the WhatsApp message templates, and the "click to send" link of an order
router.get('/templates', requireAdmin, whatsappController.listTemplates);
router.post('/templates', requireAdmin, validateBody(createWhatsappTemplateSchema), whatsappController.createTemplate);
router.delete('/templates/:eventKey', requireAdmin, whatsappController.deleteTemplate);
router.get('/log', requireAdmin, whatsappController.listLog);
router.get('/images', requireAdmin, whatsappController.listImages);
router.post(
  '/images',
  requireAdmin,
  (req, res, next) => {
    upload.single('image')(req, res, (error) => {
      if (error) {
        const message = error.code === 'LIMIT_FILE_SIZE' ? 'The picture is too large.' : error.message || 'Upload failed';
        return res.status(400).json({ success: false, message });
      }
      next();
    });
  },
  whatsappController.uploadImage
);
router.put('/templates/:eventKey', requireAdmin, validateBody(updateWhatsappTemplateSchema), whatsappController.updateTemplate);
router.post('/link', requireAdmin, validateBody(createWhatsappLinkSchema), whatsappController.createLink);

// WhatsApp Automated Bot management & Verification settings
router.get('/bot/status', requireAdmin, whatsappController.getBotStatus);
router.post('/bot/connect', requireAdmin, whatsappController.connectBot);
router.post('/bot/pairing-code', requireAdmin, whatsappController.getPairingCode);
router.post('/bot/disconnect', requireAdmin, whatsappController.disconnectBot);
router.get('/verification-settings', requireAdmin, whatsappController.getVerificationSettings);
router.put('/verification-settings', requireAdmin, whatsappController.updateVerificationSettings);

export default router;
