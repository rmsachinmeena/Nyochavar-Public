import { authController } from '../controllers/authController.js';
import { checkSession, logoutSession, refreshSession } from '../src/controllers/sessionController.js';
import { requireAuth, requireBuyer } from '../src/middlewares/authenticate.js';
import { createRouter } from '../src/middlewares/rateLimiter.js';
import { requireTrustedOrigin } from '../src/middlewares/security.js';
import { validateBody } from '../src/middlewares/validate.js';
import {
  checkEmailSchema,
  completeSignupSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  identifySchema,
  loginSchema,
  resendOtpSchema,
  resetPasswordSchema,
  signupSchema,
  userLoginSchema,
  verifyAccountSchema,
  verifyOtpSchema,
} from '../src/validators/auth.js';

const router = createRouter();

// Account creation & OTP
router.post('/signup', validateBody(signupSchema), authController.signup);
router.post('/verify', validateBody(verifyOtpSchema), authController.verifyOtp);
// Needs the access token that /verify hands out, so only the verified owner can set name + password
router.post('/complete-signup', requireBuyer, validateBody(completeSignupSchema), authController.completeSignup);
router.post('/resend', validateBody(resendOtpSchema), authController.resendOtp);

// Login
router.post('/login', validateBody(userLoginSchema), authController.login);
// Sign-in in two steps: first who is this (and does the account need a code), then the password or the code
router.post('/identify', validateBody(identifySchema), authController.identify);
router.post('/identify/verify', validateBody(verifyAccountSchema), authController.verifyAccount);
router.post('/google', validateBody(googleAuthSchema), authController.googleAuth);
router.post('/admin-login', validateBody(loginSchema), authController.adminLogin);
router.post('/admin/login', validateBody(loginSchema), authController.adminLogin);

// Password recovery
// Status-only lookup (POST so the address stays out of URLs and logs); the UI calls it before asking for a reset email
router.post('/check-email', validateBody(checkEmailSchema), authController.checkEmail);
router.post('/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);

// Session lifecycle (buyer and superadmin each have their own refresh cookie)
// requireTrustedOrigin: these use the refresh cookie, so foreign sites must not be able to trigger them
router.post('/refresh', requireTrustedOrigin, refreshSession('buyer'));
router.post('/logout', requireTrustedOrigin, logoutSession('buyer'));
router.post('/admin/refresh', requireTrustedOrigin, refreshSession('superadmin'));
router.post('/admin/logout', requireTrustedOrigin, logoutSession('superadmin'));
router.post('/rider/refresh', requireTrustedOrigin, refreshSession('rider'));
router.post('/rider/logout', requireTrustedOrigin, logoutSession('rider'));
router.get('/check', requireAuth, checkSession);

export default router;
