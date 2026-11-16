-- =====================================================================
-- 005_user_events_schema.sql
-- Single Generic User Events Table & Aggregated Summary Layer
-- =====================================================================

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- In case a failed attempt created a partial or mismatched table
drop table if exists public.user_events cascade;

-- ---------------------------------------------------------------------
-- 1. USER_EVENTS (Single Generic Table with JSONB)
-- user_id is TEXT to match public.users(id) (migrated to TEXT in 004)
-- Only meaningful actions tracked. Micro-interactions (hover/scroll) excluded.
-- ---------------------------------------------------------------------
create table if not exists public.user_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     text references public.users(id) on delete set null,
  session_id  text,
  event_type  varchar(50) not null check (
    event_type in (
      'page_view',
      'product_view',
      'search',
      'add_to_cart',
      'remove_from_cart',
      'wishlist_add',
      'checkout_start',
      'purchase',
      'coupon_applied'
    )
  ),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. HIGH-PERFORMANCE INDEXING
-- Fast querying for user history, event aggregation, and chronological timelines
-- ---------------------------------------------------------------------
create index if not exists idx_user_events_user_id 
  on public.user_events (user_id);

create index if not exists idx_user_events_event_type 
  on public.user_events (event_type);

create index if not exists idx_user_events_created_at 
  on public.user_events (created_at desc);

-- Composite index for instant per-user chronological timeline pagination
create index if not exists idx_user_events_user_created 
  on public.user_events (user_id, created_at desc);

-- Fast lookup for session stitching (attributing guest actions to newly logged-in users)
create index if not exists idx_user_events_session_id 
  on public.user_events (session_id);

-- GIN index for fast JSONB metadata querying
create index if not exists idx_user_events_metadata 
  on public.user_events using gin (metadata);

-- ---------------------------------------------------------------------
-- 3. AGGREGATED SUMMARY LAYER (Instant Psychology Snapshot View)
-- Pre-calculates totals per user so SuperAdmin can view without heavy scans
-- ---------------------------------------------------------------------
create or replace view public.user_activity_summary as
select 
  u.id as user_id,
  u.name,
  u.email,
  u.created_at as registered_at,
  max(e.created_at) as last_active,
  count(e.id) as total_events,
  count(e.id) filter (where e.event_type = 'page_view') as page_views,
  count(e.id) filter (where e.event_type = 'product_view') as product_views,
  count(e.id) filter (where e.event_type = 'search') as search_count,
  count(e.id) filter (where e.event_type = 'add_to_cart') as cart_adds,
  count(e.id) filter (where e.event_type = 'remove_from_cart') as cart_removes,
  count(e.id) filter (where e.event_type = 'wishlist_add') as wishlist_adds,
  count(e.id) filter (where e.event_type = 'checkout_start') as checkout_starts,
  count(e.id) filter (where e.event_type = 'purchase') as purchases,
  count(e.id) filter (where e.event_type = 'coupon_applied') as coupons_used
from public.users u
left join public.user_events e on u.id = e.user_id
group by u.id, u.name, u.email, u.created_at;

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY & ACCESS POLICIES
-- ---------------------------------------------------------------------
alter table public.user_events enable row level security;

drop policy if exists "Allow backend API access to user_events" on public.user_events;
create policy "Allow backend API access to user_events"
  on public.user_events
  for all
  using (true)
  with check (true);

