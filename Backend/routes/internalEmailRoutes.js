import { createHash, timingSafeEqual } from 'node:crypto';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { validateBody } from '../src/middlewares/validate.js';
import { sendEmailSchema } from '../src/validators/internalEmail.js';
import { emailService } from '../services/emailService.js';

const router = createRouter();

// Compare digests, so the check takes the same time whatever the length of the key that was sent
const digest = (value) => createHash('sha256').update(String(value)).digest();

// Only the main backend (which knows EMAIL_API_KEY) may use this route: without the key it would be an open mail relay
const requireEmailKey = (req, res, next) => {
  const expected = process.env.EMAIL_API_KEY;
  if (!expected) {
    return res.status(503).json({ success: false, code: 'MAIL_SERVER_DISABLED', error: 'This server is not set up to send mail for others.' });
  }
  const given = req.headers['x-api-key'];
  if (typeof given !== 'string' || !timingSafeEqual(digest(given), digest(expected))) {
    return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', error: 'Authentication required.' });
  }
  next();
};

// POST /api/internal/send-email: the main backend (Render) sends a finished message here, this server (Vercel) delivers it over SMTP
router.post('/send-email', requireEmailKey, validateBody(sendEmailSchema), async (req, res) => {
  const { type, to, subject, html } = req.body;
  try {
    await emailService.sendDirect(to, subject, html);
    console.log(`[MailServer] ${type} mail sent`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[MailServer] ${type} mail failed: ${error.message}`);
    // Only the holder of the shared key reaches this point, so the reason is safe to return: the main backend logs it
    res.status(502).json({ success: false, code: 'MAIL_SEND_FAILED', error: 'The mail could not be sent.', reason: String(error.message).slice(0, 160) });
  }
});

export default router;
