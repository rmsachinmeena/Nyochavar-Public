-- Notifications v2: typed in-app messages, editable templates for automatic triggers, and admin broadcasts.
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- SECURITY: this table never stores OTPs, passwords, reset codes or tokens. Login / signup / reset codes go by
-- email only. Only the delivery OTP (the code the customer reads out to the rider) may appear in `data`.

-- ---------------------------------------------------------------------------
-- 1. notifications: extra columns (existing rows keep working)
-- ---------------------------------------------------------------------------
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type         TEXT        NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS order_id     TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link         TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data         JSONB       NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key    TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS broadcast_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at      TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('order', 'payment', 'delivery', 'account', 'offer', 'announcement', 'system'));

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread      ON notifications (buyer_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast   ON notifications (broadcast_id) WHERE broadcast_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. notification_templates: one row per automatic trigger. Superadmin edits the wording and switches each on/off.
--    Placeholders: {{name}} {{order_number}} {{amount}} {{delivery_slot}} {{rider_name}} {{delivery_otp}}
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_templates (
  event_key   TEXT PRIMARY KEY,
  category    TEXT        NOT NULL DEFAULT 'system',
  label       TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,   -- this trigger on/off
  send_email  BOOLEAN     NOT NULL DEFAULT false,  -- also send it as an email
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO notification_templates (event_key, category, label, title, message, is_active, send_email) VALUES
  ('welcome',          'account',  'New account created',   'Welcome to Petal & Pen, {{name}}!',      'Your account is ready. Explore gifts and enjoy free handwritten notes on every order.', true, false),
  ('order_placed',     'order',    'Order placed',          'Order {{order_number}} confirmed',       'Thank you {{name}}! We have received your order of {{amount}} and are getting it ready.', true, false),
  ('payment_paid',     'payment',  'Payment received',      'Payment received',                       'We received {{amount}} for order {{order_number}}. Thank you!', true, false),
  ('payment_failed',   'payment',  'Payment failed',        'Payment failed',                         'Your payment for order {{order_number}} did not go through. You can try again from checkout.', true, false),
  ('rider_assigned',   'delivery', 'Rider assigned',        'A rider is on the way to pick up your gift', '{{rider_name}} will deliver order {{order_number}}.', true, false),
  ('out_for_delivery', 'delivery', 'Out for delivery',      'Your order is out for delivery',         'Order {{order_number}} is on its way. Share delivery code {{delivery_otp}} with the rider when it arrives.', true, false),
  ('delivered',        'delivery', 'Order delivered',       'Order delivered',                        'Order {{order_number}} has been delivered. We hope they love it!', true, false),
  ('order_cancelled',  'order',    'Order cancelled',       'Order {{order_number}} cancelled',       'Your order {{order_number}} was cancelled. If you paid online, the refund goes back to your original payment method.', true, false)
ON CONFLICT (event_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. notification_settings: single row, master switch for ALL automatic triggers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_settings (
  id                 INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  automatic_enabled  BOOLEAN     NOT NULL DEFAULT true,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO notification_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. notification_broadcasts: every message the superadmin sends (to one user, selected users or everyone)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL,
  message          TEXT        NOT NULL,
  link             TEXT,
  audience         TEXT        NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'selected', 'user')),
  channels         TEXT[]      NOT NULL DEFAULT ARRAY['in_app']::TEXT[],   -- in_app, email
  recipient_count  INTEGER     NOT NULL DEFAULT 0,
  email_sent_count INTEGER     NOT NULL DEFAULT 0,
  sent_by          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON notification_broadcasts (created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Security: the backend uses the service role (bypasses RLS). With RLS on and no policy, the browser's anon key
--    can read nothing directly. Live updates are pushed by our own server over the existing socket instead.
-- ---------------------------------------------------------------------------
ALTER TABLE notification_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_broadcasts ENABLE ROW LEVEL SECURITY;

-- Make PostgREST pick up the new columns right away
NOTIFY pgrst, 'reload schema';
