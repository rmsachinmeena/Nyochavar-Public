import { notificationAdminController } from '../controllers/notificationAdminController.js';
import { requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { validateBody } from '../src/middlewares/validate.js';
import { sendNotificationSchema, updateNotificationSettingsSchema, updateTemplateSchema } from '../src/validators/notifications.js';

const router = createRouter();

// Superadmin only: automatic trigger control, templates, and manual broadcasts
router.get('/settings', requireAdmin, notificationAdminController.getSettings);
router.put('/settings', requireAdmin, validateBody(updateNotificationSettingsSchema), notificationAdminController.updateSettings);
router.get('/templates', requireAdmin, notificationAdminController.listTemplates);
router.put('/templates/:eventKey', requireAdmin, validateBody(updateTemplateSchema), notificationAdminController.updateTemplate);
router.get('/broadcasts', requireAdmin, notificationAdminController.listBroadcasts);
router.post('/send', requireAdmin, validateBody(sendNotificationSchema), notificationAdminController.send);

export default router;
