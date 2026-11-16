-- Delivery data used to live inside orders.items as a hidden "__delivery_meta" entry (mixed with the products).
-- It now has its own columns on `orders`, so it can be indexed and queried (for example "all orders of this rider").
-- Also adds the rider's "delivery failed / reschedule" report.
-- Run once in the Supabase SQL editor, BEFORE restarting the backend.

-- 1. New columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_id    TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_name  TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp           TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at            TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS out_for_delivery_at    TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at           TIMESTAMPTZ;
-- Set by the rider when the handover did not happen; cleared when an admin acts on the order again
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_issue         TEXT
  CHECK (delivery_issue IS NULL OR delivery_issue IN ('failed', 'reschedule'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_issue_at      TIMESTAMPTZ;

-- 2. Copy what is already stored in the items JSON into the new columns
UPDATE orders o
SET delivery_partner_id    = NULLIF(m.meta->>'delivery_partner_id', ''),
    delivery_partner_name  = NULLIF(m.meta->>'delivery_partner_name', ''),
    delivery_partner_phone = NULLIF(m.meta->>'delivery_partner_phone', ''),
    delivery_otp           = NULLIF(m.meta->>'delivery_otp', ''),
    out_for_delivery_at    = NULLIF(m.meta->>'out_for_delivery_at', '')::timestamptz,
    delivered_at           = NULLIF(m.meta->>'delivered_at', '')::timestamptz
FROM (
  SELECT o2.id, e AS meta
  FROM orders o2,
       jsonb_array_elements(CASE WHEN jsonb_typeof(o2.items::jsonb) = 'array' THEN o2.items::jsonb ELSE '[]'::jsonb END) e
  WHERE e->>'__delivery_meta' = 'true'
) m
WHERE o.id = m.id;

-- 3. Remove the hidden entry from items, so items only holds products
UPDATE orders
SET items = COALESCE(
  (SELECT jsonb_agg(e) FROM jsonb_array_elements(items::jsonb) e WHERE e->>'__delivery_meta' IS DISTINCT FROM 'true'),
  '[]'::jsonb
)
WHERE jsonb_typeof(items::jsonb) = 'array' AND items::text LIKE '%__delivery_meta%';

-- 4. A rider's orders are now found with an index instead of reading the whole table
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner_id ON orders (delivery_partner_id) WHERE delivery_partner_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
