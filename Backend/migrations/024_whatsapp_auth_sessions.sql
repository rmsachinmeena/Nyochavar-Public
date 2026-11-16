-- Migration 024: Persistent WhatsApp Bot Auth Sessions in Database
-- This ensures WhatsApp bot login survives all Render container redeploys, commits & restarts.

CREATE TABLE IF NOT EXISTS public.whatsapp_auth_sessions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS & allow backend full access
ALTER TABLE public.whatsapp_auth_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to whatsapp_auth_sessions" ON public.whatsapp_auth_sessions;
CREATE POLICY "Allow service role full access to whatsapp_auth_sessions"
  ON public.whatsapp_auth_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

