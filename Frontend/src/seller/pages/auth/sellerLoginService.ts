import { API_BASE_URL } from '../../../services/apiConfig';
import { setSellerToken } from '../../services/sellerApi';

export interface SellerIdentifyResult {
  /** 'not_found' = no seller account has this email / number; 'password' = ask for the password next */
  status: 'not_found' | 'password';
  sentTo?: string;
}

export interface SellerResetCodeResult {
  status: 'not_found' | 'sent';
  /** Masked place the code went to, for example "+91 ••••••3210" */
  sentTo?: string;
}

export const sellerLoginService = {
  /** Step 1: does a seller account exist for this email / mobile number? */
  identify: async (identifier: string): Promise<SellerIdentifyResult> => {
    try {
      const res = await fetch(`${API_BASE_URL}/seller/auth/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not verify seller account');
      }
      return { status: data.status, sentTo: data.masked };
    } catch (err: any) {
      console.error('Error in seller identify:', err);
      throw new Error(err.message || 'Server connection failed. Please try again.');
    }
  },

  /** Step 2: sign in with the password. Throws an Error with a readable message when it is wrong. */
  login: async (credentials: { identifier: string; password: string }): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE_URL}/seller/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: credentials.identifier.trim(),
          password: credentials.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid email/mobile or password');
      }
      if (!data.token) throw new Error('Could not sign in. Please try again.');
      // The portal sees the new token and loads this seller's store, products, orders and earnings
      setSellerToken(data.token);
    } catch (err: any) {
      console.error('Error in seller login:', err);
      throw new Error(err.message || 'Could not sign in. Please try again.');
    }
  },

  /** Forgot password, step 1: check the seller exists, then send a code */
  sendResetCode: async (identifier: string): Promise<SellerResetCodeResult> => {
    try {
      const res = await fetch(`${API_BASE_URL}/seller/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send reset code');
      }
      return { status: data.status, sentTo: data.sentTo };
    } catch (err: any) {
      console.error('Error sending reset code:', err);
      throw new Error(err.message || 'Could not send verification code');
    }
  },

  /** Forgot password, step 2: the code and the new password. Throws an Error with a readable message when the code is wrong. */
  resetPassword: async (data: { identifier: string; otp: string; newPassword: string }): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE_URL}/seller/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: data.identifier.trim(),
          code: data.otp.trim(),
          newPassword: data.newPassword,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }
    } catch (err: any) {
      console.error('Error resetting seller password:', err);
      throw new Error(err.message || 'Failed to reset password');
    }
  },
};
