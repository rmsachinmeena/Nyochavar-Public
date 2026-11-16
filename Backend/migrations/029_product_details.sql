-- Migration 029: extra product information a seller gives in the "List a new product" form
-- Run this once in the Supabase SQL editor (after 028). It adds one column and no data.

-- Brand, what is in the box, dispatch time, food details (FSSAI, ingredients, shelf life), GST, HSN, returns, origin...
-- kept together as one JSON object, so the product page can show whichever of them the seller filled in.
alter table public.products add column if not exists details jsonb default '{}'::jsonb;
