-- Migration 021: Phone Verification System & Superadmin Verification Settings
-- Run once in the Supabase SQL editor.

-- 1. Table to store phone OTP requests and verifications
CREATE TABLE IF NOT EXISTS phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  otp_expiry TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  provider TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'firebase'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_created ON phone_verifications(created_at DESC);

-- 2. Add phone verification columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- 3. Superadmin verification settings: control WhatsApp / Firebase / active provider
CREATE TABLE IF NOT EXISTS verification_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  active_provider TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'firebase' | 'both' | 'disabled'
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  firebase_enabled BOOLEAN NOT NULL DEFAULT false,
  otp_expiry_minutes INT NOT NULL DEFAULT 5,
  max_attempts INT NOT NULL DEFAULT 5,
  custom_whatsapp_message TEXT NOT NULL DEFAULT 'Your {{brand}} verification code is {{otp}}. Valid for {{minutes}} minutes. Please do not share this code with anyone.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default settings row if not present
INSERT INTO verification_settings (id, active_provider, whatsapp_enabled, firebase_enabled, otp_expiry_minutes, max_attempts)
VALUES ('global', 'whatsapp', true, false, 5, 5)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';

