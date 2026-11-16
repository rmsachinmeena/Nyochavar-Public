-- Migration 022: Dynamic WhatsApp Automated Triggers
-- Adds auto_send toggle to whatsapp_templates and adds standard event templates.
-- Run once in the Supabase SQL editor.

-- 1. Add auto_send column to whatsapp_templates
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS auto_send BOOLEAN NOT NULL DEFAULT false;

-- 2. Insert standard event templates if they do not exist
INSERT INTO whatsapp_templates (event_key, name, message, is_active, auto_send) VALUES
  (
    'order_confirmed',
    'Order Confirmed',
    'Hi {{name}}, your {{brand}} order {{order_number}} for {{products}} is confirmed! Expected delivery: {{delivery_date}}, {{delivery_time}}. Total: {{amount}}. Thank you for choosing {{brand}}! 🎁',
    true,
    false
  ),
  (
    'rider_assigned',
    'Delivery Partner Assigned',
    'Hi {{name}}, your {{brand}} order {{order_number}} is packed! {{rider_name}} ({{rider_phone}}) has been assigned as your delivery partner. 🚴',
    true,
    false
  ),
  (
    'out_for_delivery',
    'Out for Delivery',
    'Hi {{name}}, your order for {{products}} is on its way! {{rider_name}} ({{rider_phone}}) is out for delivery. Expected: {{delivery_date}}, {{delivery_time}}. - {{brand}}',
    true,
    false
  ),
  (
    'delivered',
    'Order Delivered',
    'Hi {{name}}, your {{brand}} order {{order_number}} has been successfully delivered! We hope you loved your gift. Thank you! ❤️ - {{brand}}',
    true,
    false
  ),
  (
    'order_cancelled',
    'Order Cancelled',
    'Hi {{name}}, your {{brand}} order {{order_number}} has been cancelled. If this was a mistake, please reach out to us. - {{brand}}',
    true,
    false
  )
ON CONFLICT (event_key) DO UPDATE SET
  auto_send = EXCLUDED.auto_send;

NOTIFY pgrst, 'reload schema';

