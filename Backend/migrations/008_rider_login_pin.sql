-- Visible rider login PIN for the superadmin riders page. Run AFTER 007_rider_auth.sql.

-- pin_hash stays the source of truth for rider login; login_pin is the same 4-digit PIN
-- in plain text so a superadmin can always look it up. Only returned by GET /api/delivery-partners.
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS login_pin TEXT;
