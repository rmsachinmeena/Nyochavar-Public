import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';



let confirmationResultStore: ConfirmationResult | null = null;
let recaptchaVerifierStore: RecaptchaVerifier | null = null;

/**
 * Format 10-digit Indian or international phone to +91XXXXXXXXXX
 */
export const formatE164Phone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
};

export const firebaseAuthService = {
  isConfigured: () => isFirebaseConfigured,

  /**
   * Initializes or returns existing RecaptchaVerifier on a DOM element container
   */
  initRecaptcha: (containerId: string = 'recaptcha-container'): RecaptchaVerifier => {
    if (recaptchaVerifierStore) {
      try {
        recaptchaVerifierStore.clear();
      } catch {
        // ignore
      }
      recaptchaVerifierStore = null;
    }

    recaptchaVerifierStore = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved - allow signInWithPhoneNumber
      },
      'expired-callback': () => {
        console.warn('[Firebase] Recaptcha expired');
      },
    });

    return recaptchaVerifierStore;
  },

  /**
   * Sends an SMS OTP to customer phone number via Firebase
   */
  sendSmsOtp: async (phone: string, containerId: string = 'recaptcha-container') => {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase configuration is missing in Frontend/.env. Please configure Firebase API keys.');
    }

    const formatted = formatE164Phone(phone);
    const verifier = firebaseAuthService.initRecaptcha(containerId);

    try {
      const confirmation = await signInWithPhoneNumber(auth, formatted, verifier);
      confirmationResultStore = confirmation;
      return {
        success: true,
        phone: formatted,
        provider: 'firebase',
        message: `SMS verification code sent to ${formatted}`,
      };
    } catch (err: any) {
      console.error('[Firebase Phone Auth] Error sending SMS:', err);
      // Reset verifier so user can try again
      if (recaptchaVerifierStore) {
        try {
          recaptchaVerifierStore.clear();
        } catch {}
        recaptchaVerifierStore = null;
      }
      throw new Error(err.message || 'Failed to send SMS verification code.');
    }
  },

  /**
   * Verifies the 6-digit SMS code entered by the customer
   */
  verifySmsOtp: async (otp: string) => {
    if (!confirmationResultStore) {
      throw new Error('No pending SMS verification found. Please request a new code.');
    }

    try {
      const result = await confirmationResultStore.confirm(otp);
      const user = result.user;
      const idToken = await user.getIdToken();

      return {
        success: true,
        user,
        idToken,
        phone: user.phoneNumber,
        message: 'Mobile number verified successfully via Firebase!',
      };
    } catch (err: any) {
      console.error('[Firebase Phone Auth] Verification error:', err);
      throw new Error(err.message || 'Invalid or expired verification code.');
    }
  },

  /**
   * Reset session
   */
  clear: () => {
    confirmationResultStore = null;
    if (recaptchaVerifierStore) {
      try {
        recaptchaVerifierStore.clear();
      } catch {}
      recaptchaVerifierStore = null;
    }
  },
};

