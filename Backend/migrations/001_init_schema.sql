-- =====================================================================
-- Petal & Pen — Gift Startup: Supabase (PostgreSQL) schema
-- Run this once in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Matches: Backend/models/userModel.js, Backend/controllers/authController.js,
-- Frontend/src/types.ts, Frontend/src/data/products.ts, indianProducts.ts,
-- hamperOptions.ts, CheckoutSection.tsx, ProfilePage.tsx, FavoritesModal.tsx
-- =====================================================================

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- Helper: auto-update updated_at column
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- 1. USERS  (matches Backend/models/userModel.js exactly)
-- =====================================================================
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  is_verified   boolean not null default false,
  otp_code      text,
  otp_expiry    timestamptz,
  phone         text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create index if not exists idx_users_email on public.users (email);

-- =====================================================================
-- 2. ADDRESSES  (for Checkout / Profile "Address" tab)
-- =====================================================================
create table if not exists public.addresses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  label           text default 'Home',
  recipient_name  text not null,
  recipient_phone text not null,
  address_line    text not null,
  city            text not null,
  state           text,
  zip_code        text not null,
  country         text default 'India',
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_addresses_user_id on public.addresses (user_id);

-- =====================================================================
-- 3. PRODUCTS  (matches Frontend/src/types.ts -> Product)
-- =====================================================================
create table if not exists public.products (
  id             text primary key,               -- e.g. 'prod-rose-chocolate-hamper'
  name           text not null,
  tagline        text,
  category       text not null check (category in ('Flowers','Hampers','Personalized Gifts')),
  occasions      text[] not null default '{}',
  price          numeric(10,2) not null check (price >= 0),
  currency       text not null default 'USD' check (currency in ('USD','INR')),
  rating         numeric(2,1) default 0,
  review_count   integer default 0,
  is_best_seller boolean default false,
  is_new         boolean default false,
  image          text,
  gallery        text[] default '{}',
  description    text,
  hues           text[] default '{}',
  gender         text check (gender in ('men','women','unisex')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_occasions on public.products using gin (occasions);
create index if not exists idx_products_active on public.products (is_active);

-- =====================================================================
-- 4. PRODUCT ADDONS  (matches Product.addons -> ProductAddon)
-- =====================================================================
create table if not exists public.product_addons (
  id         uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  addon_key  text not null,
  name       text not null,
  price      numeric(10,2) not null default 0,
  unique (product_id, addon_key)
);

create index if not exists idx_product_addons_product_id on public.product_addons (product_id);

-- =====================================================================
-- 5. PALETTE OPTIONS  (matches Frontend/src/data/hamperOptions.ts)
-- =====================================================================
create table if not exists public.palette_options (
  id             text primary key,
  name           text not null,
  tagline        text,
  color_swatches text[] default '{}',
  preview_image  text
);

-- =====================================================================
-- 6. FAVORITES / WISHLIST  (matches FavoritesModal.tsx)
-- =====================================================================
create table if not exists public.favorites (
  user_id    uuid not null references public.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- =====================================================================
-- 7. CART ITEMS  (matches Frontend/src/types.ts -> CartItem)
-- =====================================================================
create table if not exists public.cart_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  product_id      text not null references public.products(id),
  quantity        integer not null default 1 check (quantity > 0),
  selected_hue    text,
  message         text,
  delivery_date   date,
  delivery_slot   text,
  custom_photo_url text,
  palette_id      text references public.palette_options(id),
  addons          jsonb not null default '[]',   -- snapshot: [{ "id","name","price" }]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_cart_items_updated_at on public.cart_items;
create trigger trg_cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

create index if not exists idx_cart_items_user_id on public.cart_items (user_id);

-- =====================================================================
-- 8. ORDERS  (matches CheckoutSection.tsx)
-- =====================================================================
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,            -- e.g. 'PP-482913'
  user_id         uuid references public.users(id) on delete set null,
  status          text not null default 'pending'
                    check (status in ('pending','confirmed','processing','out_for_delivery','delivered','cancelled')),
  payment_method  text check (payment_method in ('card','upi','cod')),
  payment_status  text not null default 'pending'
                    check (payment_status in ('pending','paid','failed','refunded')),
  subtotal        numeric(10,2) not null default 0,
  delivery_fee    numeric(10,2) not null default 0,
  tax             numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  currency        text not null default 'USD',
  recipient_name  text not null,
  recipient_phone text not null,
  address_line    text not null,
  city            text not null,
  zip_code        text not null,
  delivery_date   date,
  delivery_slot   text,
  placed_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index if not exists idx_orders_user_id on public.orders (user_id);
create index if not exists idx_orders_status on public.orders (status);

-- =====================================================================
-- 9. ORDER ITEMS  (line items snapshot, survives future price/product edits)
-- =====================================================================
create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  product_id       text references public.products(id),
  name             text not null,
  image            text,
  price            numeric(10,2) not null,
  quantity         integer not null check (quantity > 0),
  selected_hue     text,
  message          text,
  addons           jsonb not null default '[]',
  custom_photo_url text,
  palette_id       text
);

create index if not exists idx_order_items_order_id on public.order_items (order_id);

-- =====================================================================
-- 10. HAMPER BUILDER DRAFTS  (matches HamperBuilderSection.tsx -> BuilderState)
-- =====================================================================
create table if not exists public.hamper_builder_drafts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.users(id) on delete cascade,
  occasion         text,
  custom_photo_url text,
  sentiment_note   text,
  theme_palette    text check (theme_palette in ('blush','ocean','champagne')),
  budget           numeric(10,2),
  created_at       timestamptz not null default now()
);

create index if not exists idx_hamper_drafts_user_id on public.hamper_builder_drafts (user_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- Backend (Backend/config/supabase.js) connects with the Supabase
-- SERVICE ROLE key, which always bypasses RLS. So RLS below only matters
-- if you later call Supabase directly from the browser with the anon key.
-- =====================================================================
alter table public.users                 enable row level security;
alter table public.addresses             enable row level security;
alter table public.products              enable row level security;
alter table public.product_addons        enable row level security;
alter table public.palette_options       enable row level security;
alter table public.favorites             enable row level security;
alter table public.cart_items            enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.hamper_builder_drafts enable row level security;

-- Public (anon + logged-in browser) can only READ the catalog.
drop policy if exists "Public read products" on public.products;
create policy "Public read products" on public.products
  for select using (is_active = true);

drop policy if exists "Public read product_addons" on public.product_addons;
create policy "Public read product_addons" on public.product_addons
  for select using (true);

drop policy if exists "Public read palette_options" on public.palette_options;
create policy "Public read palette_options" on public.palette_options
  for select using (true);

-- Every other table (users, addresses, favorites, cart_items, orders,
-- order_items, hamper_builder_drafts) has RLS enabled with NO policies,
-- so anon/authenticated browser keys get zero access — only your Node
-- backend (service role key) can read/write them. This keeps passwords,
-- OTPs, other users' orders/cart etc. safe even if the anon key leaks.
