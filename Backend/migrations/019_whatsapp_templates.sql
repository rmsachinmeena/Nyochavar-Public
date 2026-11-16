-- WhatsApp "click to send" messages (no paid API): the superadmin presses a button on an order, WhatsApp opens with the
-- customer's number and the message already filled in, and the admin only has to press Send.
-- Run once in the Supabase SQL editor.

-- 1. The message templates the superadmin can edit
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  event_key   TEXT PRIMARY KEY,                 -- order_confirmed, out_for_delivery, ...
  name        TEXT NOT NULL,                    -- shown on the order's WhatsApp menu
  message     TEXT NOT NULL,                    -- with {{placeholders}}: name, products, delivery_date, delivery_time, rider_name, rider_phone, amount, brand
  is_active   BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO whatsapp_templates (event_key, name, message) VALUES
  ('order_confirmed',  'Order confirmed',
   'Hi {{name}}, your {{brand}} order for {{products}} is confirmed. It will reach you on {{delivery_date}}, {{delivery_time}}. Thank you for choosing {{brand}}!'),
  ('out_for_delivery', 'Out for delivery',
   'Hi {{name}}, your {{products}} is on its way! {{rider_name}} ({{rider_phone}}) is your delivery partner. Expected on {{delivery_date}}, {{delivery_time}}. - {{brand}}')
ON CONFLICT (event_key) DO NOTHING;

-- 2. A small log: the same message for the same order is not prepared twice within 4 hours (stops accidental spam)
CREATE SEQUENCE IF NOT EXISTS whatsapp_message_log_id_seq;

CREATE TABLE IF NOT EXISTS whatsapp_message_log (
  id          TEXT PRIMARY KEY DEFAULT ('wamsg_' || lpad(nextval('whatsapp_message_log_id_seq')::text, 3, '0')),
  order_id    TEXT NOT NULL,
  event_key   TEXT NOT NULL,
  phone       TEXT,
  admin_id    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_log_order_event ON whatsapp_message_log (order_id, event_key, created_at DESC);

NOTIFY pgrst, 'reload schema';
