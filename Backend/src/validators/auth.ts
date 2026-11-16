import { z } from 'zod';

const email = z
  .string({ error: 'Email address is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email address is required')
  .max(254, 'Email address is too long')
  .pipe(z.email('Please enter a valid email address'));

const otp = z
  .string({ error: 'OTP is required' })
  .trim()
  .regex(/^\d{4,6}$/, 'OTP must be numeric');

const password = z.string({ error: 'Password is required' }).min(1, 'Password is required').max(200, 'Password is too long');

const newPassword = z
  .string({ error: 'New password is required' })
  .trim()
  .min(6, 'Password must be at least 6 characters long')
  .max(200, 'Password is too long');

export const signupSchema = z.object({
  email,
  name: z.string().trim().max(100).optional(),
  password: z.string().max(200).optional(),
});

export const verifyOtpSchema = z.object({ email, otp });

export const resendOtpSchema = z.object({ email });

export const completeSignupSchema = z.object({
  name: z.string({ error: 'Full name is required' }).trim().min(1, 'Full name is required').max(100, 'Name is too long'),
  password: newPassword,
});

export const loginSchema = z.object({ email, password });

// A shopper may type an email address or a mobile number (10 digits, with or without +91 / spaces)
const identifier = z
  .string({ error: 'Enter your email address or mobile number' })
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address or mobile number')
  .max(254, 'That is too long')
  .refine(
    (value) =>
      value.includes('@')
        ? z.email().safeParse(value).success
        : /^\d{10,13}$/.test(value.replace(/[\s+\-()]/g, '')),
    { message: 'Enter a valid email address or 10-digit mobile number' }
  );

// Shopper login: the `email` field accepts an email or a mobile number
export const userLoginSchema = z.object({ email: identifier, password });

// Step 1 of sign-in: which kind of account is this, and what does it need next?
export const identifySchema = z.object({ identifier });

export const verifyAccountSchema = z.object({ identifier, otp });

export const checkEmailSchema = z.object({ email });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ email, otp, newPassword });

export const googleAuthSchema = z.object({
  credential: z.string({ error: 'Google credential token is required' }).min(1).max(8192),
});
