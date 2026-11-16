import { randomInt, timingSafeEqual } from 'node:crypto';

/** Digits in an email verification / password-reset code (brute force is held off by otpAttempts' lockouts). */
export const OTP_LENGTH = 4;

/** Cryptographically secure numeric code (Math.random is predictable). */
export const generateOtp = (length: number = OTP_LENGTH): string =>
  randomInt(0, 10 ** length)
    .toString()
    .padStart(length, '0');

/** 4-digit code the customer reads out at the door; guarded by per-order attempt lockout. */
export const generateDeliveryOtp = (): string => generateOtp(4);

/** Constant-time comparison so response timing does not leak how many digits matched. */
export const otpMatches = (stored: unknown, entered: unknown): boolean => {
  if (typeof stored !== 'string' || typeof entered !== 'string') return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(entered.trim());
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Expiry timestamp (ISO) `minutes` from now. */
export const otpExpiry = (minutes = 10): string => new Date(Date.now() + minutes * 60_000).toISOString();
