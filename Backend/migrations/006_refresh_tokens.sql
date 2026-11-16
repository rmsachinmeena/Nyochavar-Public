-- Refresh tokens for buyer + superadmin sessions.
-- Only the SHA-256 hash of each token is stored; a token is single-use (rotated on every refresh).
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT        NOT NULL,            -- shared by every token rotated from one login
  user_id     TEXT        NOT NULL,            -- users.id or admin id
  role        TEXT        NOT NULL CHECK (role IN ('buyer', 'superadmin')),
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens (session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens (user_id, role);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- Only the backend (service key) touches this table; keep it closed to anon/public clients.
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
