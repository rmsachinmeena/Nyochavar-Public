-- Google Sign-In: remember the Google account id (the token's "sub") for each user. Run in the Supabase SQL editor.
-- Google users never see a password step: password_hash keeps an unguessable random value, and
-- auth_provider = 'google' makes the password login reply "Please continue with Google".

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email';

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON users (google_id) WHERE google_id IS NOT NULL;
