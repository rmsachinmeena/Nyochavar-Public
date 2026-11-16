-- Migration 027: Seller Authentication & Store Onboarding Schema
-- Creates the dedicated sellers table and adds 'seller' role support.

CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name TEXT NOT NULL,
    owner_name TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    category TEXT DEFAULT 'Gourmet Hampers & Sweets',
    pincode TEXT,
    street_address TEXT,
    city TEXT DEFAULT 'Jaipur',
    pickup_slot TEXT DEFAULT 'Morning (10:00 AM - 01:00 PM)',
    payout_method TEXT DEFAULT 'upi',
    upi_id TEXT,
    bank_details JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_approval')),
    is_active BOOLEAN DEFAULT true,
    is_vacation_mode BOOLEAN DEFAULT false,
    kyc_status TEXT DEFAULT 'verified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
    reset_otp_hash TEXT,
    reset_otp_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid lookup during login
CREATE INDEX IF NOT EXISTS idx_sellers_email ON public.sellers (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_sellers_phone ON public.sellers (phone);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON public.sellers (status);

-- Update refresh_tokens role constraint to support seller
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'refresh_tokens'
    ) THEN
        ALTER TABLE public.refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_role_check;
        ALTER TABLE public.refresh_tokens 
          ADD CONSTRAINT refresh_tokens_role_check CHECK (role IN ('buyer', 'superadmin', 'rider', 'seller'));
    END IF;
END $$;
