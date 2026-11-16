-- Migration 023: a picture for every WhatsApp template (set by the superadmin) and a template for the verification code.
-- Run once in the Supabase SQL editor.

-- 1. The picture that goes out with the message (the message text becomes its caption). Empty = text only.
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. The pictures that are already in use today
UPDATE whatsapp_templates SET image_url = 'https://res.cloudinary.com/dodhs4r1l/image/upload/v1793388880/WHATSAPP_IMAGES/order_confirmed.png'  WHERE event_key = 'order_confirmed'  AND image_url IS NULL;
UPDATE whatsapp_templates SET image_url = 'https://res.cloudinary.com/dodhs4r1l/image/upload/v1793389875/WHATSAPP_IMAGES/rider_assigned.png'    WHERE event_key = 'rider_assigned'    AND image_url IS NULL;
UPDATE whatsapp_templates SET image_url = 'https://res.cloudinary.com/dodhs4r1l/image/upload/v1793389873/WHATSAPP_IMAGES/out_for_delivery.png'  WHERE event_key = 'out_for_delivery'  AND image_url IS NULL;
UPDATE whatsapp_templates SET image_url = 'https://res.cloudinary.com/dodhs4r1l/image/upload/v1793389876/WHATSAPP_IMAGES/delivered.png'        WHERE event_key = 'delivered'        AND image_url IS NULL;
UPDATE whatsapp_templates SET image_url = 'https://res.cloudinary.com/dodhs4r1l/image/upload/v1793389877/WHATSAPP_IMAGES/order_cancelled.png'   WHERE event_key = 'order_cancelled'   AND image_url IS NULL;

-- 3. The verification code message. {{otp}} is required in it; {{minutes}} and {{brand}} are optional.
INSERT INTO whatsapp_templates (event_key, name, message, is_active, auto_send, image_url) VALUES (
  'verify_otp',
  'Verify OTP',
  E'🎁 *{{brand}} Verification Code*\n\nDear Customer, your one-time verification code (OTP) is:\n\n🔐 *{{otp}}*\n\n⏳ Valid for *{{minutes}} minutes*. For account security, please do not share this code with anyone.\n\nThank you for choosing *{{brand}}*! ✨',
  true,
  true,
  'https://res.cloudinary.com/dodhs4r1l/image/upload/v1793389878/WHATSAPP_IMAGES/verify_otp.png'
) ON CONFLICT (event_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
