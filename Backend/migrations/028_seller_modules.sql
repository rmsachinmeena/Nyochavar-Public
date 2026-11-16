-- Migration 028: Seller portal (products, orders, settings)
-- Run this once in the Supabase SQL editor. It adds columns and one table; it adds no data.

-- 1. Which seller owns a product (empty = a product of the Nyochavar store itself)
alter table public.products add column if not exists seller_id uuid references public.sellers(id) on delete set null;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists weight_grams integer;
create index if not exists idx_products_seller_id on public.products (seller_id);

-- 2. Store profile details the seller settings page shows
alter table public.sellers add column if not exists gstin text;
alter table public.sellers add column if not exists pan text;
alter table public.sellers add column if not exists logo_url text;
alter table public.sellers add column if not exists banner_url text;
alter table public.sellers add column if not exists bio text;

-- 3. Password-reset code: count wrong tries so a code cannot be guessed
alter table public.sellers add column if not exists reset_attempts integer default 0;

-- 4. What a seller did with an order that contains their products (ready for pickup + the pickup code for the rider).
--    The order's own status (delivered, cancelled, out for delivery) stays in `orders`.
create table if not exists public.seller_order_updates (
    order_id    text not null,
    seller_id   uuid not null references public.sellers(id) on delete cascade,
    status      text not null default 'new' check (status in ('new', 'ready_for_pickup')),
    pickup_otp  text,
    updated_at  timestamptz default now(),
    primary key (order_id, seller_id)
);
create index if not exists idx_seller_order_updates_seller on public.seller_order_updates (seller_id);
