import { request, saveSessionTokens } from './apiClient';
import { firebaseAuthService } from './firebaseAuthService';

export interface PhoneSettingsResponse {
  success: boolean;
  activeProvider: 'whatsapp' | 'firebase' | 'both' | 'disabled';
  whatsappEnabled: boolean;
  firebaseEnabled: boolean;
  otpExpiryMinutes: number;
}

export const phoneAuthClient = {
  /**
   * Fetch current verification settings (which provider is active)
   */
  getSettings: async (): Promise<PhoneSettingsResponse> => {
    return await request<PhoneSettingsResponse>('/auth/phone/settings', {
      fallbackMessage: 'Could not load phone verification settings',
    });
  },

  /** Is this number already verified (the account's own number, or one verified recently)? */
  isVerified: async (phone: string): Promise<boolean> => {
    const data = await request<{ success: boolean; verified: boolean }>('/auth/phone/status', {
      role: 'buyer',
      query: { phone },
      fallbackMessage: 'Could not check this number',
    });
    return Boolean(data.verified);
  },

  /**
   * Send OTP via selected channel
   */
  sendOtp: async (phone: string, preferredProvider: 'whatsapp' | 'firebase' = 'whatsapp', recaptchaContainerId?: string, purpose?: 'signup') => {
    if (preferredProvider === 'firebase') {
      return await firebaseAuthService.sendSmsOtp(phone, recaptchaContainerId);
    }

    // Default to WhatsApp Bot
    return await request<{ success: boolean; message: string; expiresInMinutes?: number }>('/auth/phone/send-otp', {
      method: 'POST',
      body: purpose ? { phone, purpose } : { phone },
      fallbackMessage: 'Failed to send WhatsApp verification code',
    });
  },

  /** Forgot password by mobile number: a 404 (code ACCOUNT_NOT_FOUND) means no account has this number; otherwise a WhatsApp code is sent */
  forgotPassword: (phone: string) =>
    request<{ success: boolean; message: string }>('/auth/phone/forgot-password', {
      method: 'POST',
      body: { phone },
      fallbackMessage: 'Failed to send the verification code',
    }),

  resetPassword: (data: { phone: string; otp: string; newPassword: string }) =>
    request<{ success: boolean; message: string }>('/auth/phone/reset-password', {
      method: 'POST',
      body: data,
      fallbackMessage: 'Failed to reset the password',
    }),

  /**
   * Verify entered OTP code
   */
  verifyOtp: async ({
    phone,
    otp,
    provider,
    saveToAccount = true,
  }: {
    phone: string;
    otp: string;
    provider: 'whatsapp' | 'firebase';
    /** false when the number is not the shopper's own (a gift recipient), so the account number stays as it is */
    saveToAccount?: boolean;
  }) => {
    if (provider === 'firebase') {
      // 1. Verify code on Firebase Client SDK
      const fbResult = await firebaseAuthService.verifySmsOtp(otp);

      // 2. Sync verified state to Backend DB
      const backendResult = await request<{ success: boolean; isVerified: boolean; message: string; phone?: string }>(
        '/auth/phone/verify-firebase',
        {
          method: 'POST',
          body: {
            phone,
            idToken: fbResult.idToken,
            save_to_account: saveToAccount,
          },
          fallbackMessage: 'Failed to confirm Firebase verification with server',
        }
      );

      return {
        ...backendResult,
        phone: backendResult.phone || phone,
        firebaseUser: fbResult.user,
      };
    }

    // Default to WhatsApp Bot verification
    return await request<{ success: boolean; isVerified: boolean; message: string; phone?: string }>('/auth/phone/verify-otp', {
      method: 'POST',
      body: { phone, otp, save_to_account: saveToAccount },
      fallbackMessage: 'Incorrect or expired verification code',
    });
  },

  /**
   * Finalize account creation after phone verification
   */
  completeSignup: async ({
    name,
    phone,
    password,
    email,
  }: {
    name: string;
    phone: string;
    password: string;
    email?: string;
  }) => {
    const data = await request<{
      success: boolean;
      message: string;
      token: string;
      refreshToken: string;
      expiresIn: number;
      user: any;
    }>('/auth/phone/complete-signup', {
      method: 'POST',
      body: { name, phone, password, email },
      fallbackMessage: 'Failed to complete registration',
    });
    if (data.token) {
      saveSessionTokens('buyer', data);
    }
    return data;
  },
};
