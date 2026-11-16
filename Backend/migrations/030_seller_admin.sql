-- Migration 030: superadmin control over sellers
-- Run this once in the Supabase SQL editor (after 028 and 029). It adds columns and no data.

-- A commission just for this seller (empty = the store-wide rate, SELLER_COMMISSION_RATE, 10% by default)
alter table public.sellers add column if not exists commission_rate numeric(5,4);

-- Why and when a seller was suspended, so the admin can see it later
alter table public.sellers add column if not exists suspended_reason text;
alter table public.sellers add column if not exists status_changed_at timestamptz;
