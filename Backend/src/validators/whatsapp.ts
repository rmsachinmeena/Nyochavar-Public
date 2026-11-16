import { z } from 'zod';

// The words a template may use. Anything else is refused when the template is saved. {{otp}} and {{minutes}} belong to the
// verification-code template only (the controller refuses them in every other template, so a delivery OTP can never go out).
const ALLOWED = ['name', 'order_name', 'order_number', 'products', 'delivery_date', 'delivery_time', 'rider_name', 'rider_phone', 'amount', 'brand', 'otp', 'minutes'];

const onlyKnownPlaceholders = (text: string) =>
  [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].every((match) => ALLOWED.includes(match[1] as string));

const messageText = z
  .string()
  .trim()
  .min(5, 'The message is too short')
  .max(1000, 'The message is too long')
  .refine(onlyKnownPlaceholders, { message: `Only these placeholders can be used: ${ALLOWED.map((key) => `{{${key}}}`).join(', ')}` });

// The picture of a template: it has to be one uploaded to this shop's Cloudinary (never a link from somewhere else)
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((url) => url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || ''}/image/upload/`), {
    message: 'Upload the picture here: other links are not accepted',
  });

export const createWhatsappTemplateSchema = z.object({
  name: z.string().trim().min(2, 'Give the template a name').max(60, 'The name is too long'),
  message: messageText,
  auto_send: z.boolean().optional(),
  image_url: imageUrl.nullable().optional(),
});

export const updateWhatsappTemplateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  message: messageText.optional(),
  is_active: z.boolean().optional(),
  auto_send: z.boolean().optional(),
  image_url: imageUrl.nullable().optional(),
});

export const createWhatsappLinkSchema = z.object({
  order_id: z.string().trim().min(1).max(64),
  event_key: z.string().trim().min(1).max(64),
});
