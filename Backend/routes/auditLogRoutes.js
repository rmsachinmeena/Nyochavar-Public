import { auditLogController } from '../controllers/auditLogController.js';
import { requireAdmin } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';

const router = createRouter();

// Audit trail is superadmin-only
router.get('/', requireAdmin, auditLogController.getAllLogs);
router.get('/admin/:adminId', requireAdmin, auditLogController.getLogsByAdminId);

export default router;
