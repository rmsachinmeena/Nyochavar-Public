-- =====================================================================
-- 024. RAZORPAY PAYMENT LIFECYCLE
-- Run once in Supabase > SQL Editor. Safe to run again.
--
--  * order_status 'awaiting_payment': an online order that Razorpay has not confirmed yet. It is not an order to
--    pack: it becomes 'placed' only when the money is confirmed (verify call, webhook or the reconciler).
--  * payment_status 'failed' and 'refunded' must be allowed.
--  * refund_* columns: the refund of a cancelled paid order. Refunds are issued by hand in the Razorpay dashboard;
--    the server only records them (refund webhook, or the admin's "Mark as refunded").
--  * razorpay_events: webhook events already handled (Razorpay may deliver the same event twice).
-- =====================================================================

-- 1. Refund bookkeeping on each order
alter table public.orders
  add column if not exists refund_id     text,
  add column if not exists refund_status text,          -- due (admin must refund) | partial | processed
  add column if not exists refund_amount numeric(10,2),
  add column if not exists refunded_at   timestamptz,
  add column if not exists refund_error  text;

-- 2. Widen existing check constraints on order_status / payment_status (if the live table has them).
--    A table without such constraints is left as it is.
do $$
declare
  c record;
  had_order_status boolean := false;
  had_payment_status boolean := false;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.orders'::regclass and contype = 'c'
  loop
    if c.def ilike '%order_status%' then
      execute format('alter table public.orders drop constraint %I', c.conname);
      had_order_status := true;
    elsif c.def ilike '%payment_status%' then
      execute format('alter table public.orders drop constraint %I', c.conname);
      had_payment_status := true;
    end if;
  end loop;

  if had_order_status then
    alter table public.orders add constraint orders_order_status_check
      check (order_status in ('awaiting_payment', 'placed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'))
      not valid;
  end if;

  if had_payment_status then
    alter table public.orders add constraint orders_payment_status_check
      check (payment_status in ('pending', 'paid', 'failed', 'refunded'))
      not valid;
  end if;
end $$;

-- The reconciler looks for online orders still waiting for payment
create index if not exists idx_orders_awaiting_payment
  on public.orders (created_at)
  where order_status = 'awaiting_payment';

-- 3. Webhook events already handled
create table if not exists public.razorpay_events (
  event_id    text primary key,
  event       text not null,
  received_at timestamptz not null default now()
);

-- Only the backend (service key) touches this table; keep it closed to anon/public clients.
alter table public.razorpay_events enable row level security;

-- 4. Customer notification for refunds (wording editable by the Superadmin like the others)
insert into notification_templates (event_key, category, label, title, message, is_active, send_email) values
  ('payment_refunded', 'payment', 'Refund started', 'Refund started',
   'We have started a refund of {{amount}} for order {{order_number}}. It usually reaches your account in 5 to 7 business days.',
   true, false)
on conflict (event_key) do nothing;
