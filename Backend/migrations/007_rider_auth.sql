-- Rider authentication: real PINs + rider sessions. Run AFTER 006_refresh_tokens.sql.

-- Riders get a bcrypt-hashed login PIN (set by a superadmin via POST /api/delivery-partners/:id/reset-pin).
-- Riders with no PIN cannot log in until one is issued.
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- refresh_tokens.role now also allows 'rider'
ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_role_check;
ALTER TABLE refresh_tokens
  ADD CONSTRAINT refresh_tokens_role_check CHECK (role IN ('buyer', 'superadmin', 'rider'));
