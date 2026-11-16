-- The audit log used to write the hardcoded admin "admin_005" whenever it did not know who acted, so rider actions
-- (login, delivered with OTP) showed up as an admin's. Now every row says WHO did it and in which role.
-- Run once in the Supabase SQL editor, BEFORE restarting the backend.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT
  CHECK (actor_role IS NULL OR actor_role IN ('admin', 'rider', 'buyer', 'system'));
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id TEXT;

-- admin_id is only filled when an admin really did it
ALTER TABLE audit_logs ALTER COLUMN admin_id DROP NOT NULL;

-- Existing rows: everything was recorded under an admin
UPDATE audit_logs SET actor_role = 'admin', actor_id = admin_id WHERE actor_role IS NULL AND admin_id IS NOT NULL;

-- Correct the old rows that only a rider can have caused
UPDATE audit_logs
SET actor_role = 'rider', actor_id = record_id, admin_id = NULL
WHERE action = 'RIDER_LOGIN';

UPDATE audit_logs a
SET actor_role = 'rider', actor_id = o.delivery_partner_id, admin_id = NULL
FROM orders o
WHERE a.action = 'ORDER_DELIVERED_WITH_OTP' AND a.record_id = o.id AND o.delivery_partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_role, actor_id);

NOTIFY pgrst, 'reload schema';
