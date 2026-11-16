import { z } from 'zod';

/** The kinds of mail the main backend may hand to the mail server. Anything else is refused. */
export const EMAIL_TYPES = ['otp-verify', 'otp-reset', 'message'] as const;

// The main backend builds the whole message; the mail server only checks it is a single, well-formed email
export const sendEmailSchema = z.object({
  type: z.enum(EMAIL_TYPES),
  to: z
    .string({ error: 'A recipient email is required' })
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email('A valid recipient email is required')),
  subject: z
    .string({ error: 'A subject is required' })
    .trim()
    .min(1, 'A subject is required')
    .max(200, 'The subject is too long')
    .refine((subject) => !/[\r\n]/.test(subject), { message: 'The subject must be one line' }),
  html: z.string({ error: 'The message is required' }).min(1, 'The message is required').max(90_000, 'The message is too large'),
});
