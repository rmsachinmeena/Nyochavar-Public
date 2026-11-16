-- Superadmin notifications: one row per event (new order, delivery failed / reschedule, low stock, ...),
-- so the bell keeps its read state and history. Run once in the Supabase SQL editor.

CREATE SEQUENCE IF NOT EXISTS admin_notifications_id_seq;

CREATE TABLE IF NOT EXISTS admin_notifications (
  id           TEXT PRIMARY KEY DEFAULT ('adminnotif_' || lpad(nextval('admin_notifications_id_seq')::text, 3, '0')),

  -- what happened
  type         TEXT NOT NULL DEFAULT 'system'
               CHECK (type IN ('order', 'payment', 'delivery', 'inventory', 'customer', 'system')),
  event_key    TEXT,                               -- e.g. order_placed, delivery_failed, delivery_reschedule, low_stock, new_user, new_subscriber
  severity     TEXT NOT NULL DEFAULT 'info'
               CHECK (severity IN ('info', 'warning', 'critical')),
  title        TEXT NOT NULL,
  message      TEXT,                               -- multi-line text shown in the bell (rider, order, address, buyer, phone)
  data         JSONB NOT NULL DEFAULT '{}'::jsonb, -- extra facts: rider name, product names, address, buyer name/email/phone

  -- who / what it is about (plain ids, no foreign keys: a deleted order must not delete its history)
  order_id     TEXT,
  rider_id     TEXT,
  buyer_id     TEXT,
  product_id   TEXT,
  link         TEXT,                               -- admin page to open on click, e.g. /admin/orders

  -- the same event is never stored twice, e.g. 'delivery_failed:order_077:2026-10-22T10:00'
  dedupe_key   TEXT UNIQUE,

  -- read / dismissed state (shared by all admins, read_by says who)
  is_read      BOOLEAN NOT NULL DEFAULT false,
  read_at      TIMESTAMPTZ,
  read_by      TEXT,
  is_hidden    BOOLEAN NOT NULL DEFAULT false,     -- dismissed from the bell, row is kept
  hidden_at    TIMESTAMPTZ,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_feed
  ON admin_notifications (created_at DESC) WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
  ON admin_notifications (is_read) WHERE is_read = false AND is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_order ON admin_notifications (order_id);

NOTIFY pgrst, 'reload schema';
