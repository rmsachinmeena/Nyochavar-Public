-- =====================================================================
-- Rename every table's primary key from a random uuid to a short
-- readable prefixed id: User-001, Addr-001, Cart-001, Hamper-001,
-- Order-001, Item-001, Addon-001, Palette-001.
--
-- 'products' was already renamed to Pro-001..Pro-015 in
-- 003_rename_product_ids.sql, so it's not touched here.
--
-- 'favorites' has NO single 'id' column (its primary key is the
-- combination of user_id + product_id), so there's nothing to rename
-- there — only its user_id values are updated so it still matches
-- the new 'users' ids.
--
-- Run this once, after 001, 002 and 003.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 1: drop every foreign key that would block changing a column's
-- type (auto-detects the real constraint name Supabase generated)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  pair RECORD;
  cname text;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('addresses','user_id'),
      ('favorites','user_id'),
      ('cart_items','user_id'),
      ('cart_items','palette_id'),
      ('orders','user_id'),
      ('order_items','order_id'),
      ('hamper_builder_drafts','user_id')
    ) AS t(tbl, col)
  LOOP
    SELECT tc.constraint_name INTO cname
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND tc.table_name = pair.tbl AND kcu.column_name = pair.col;

    IF cname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', pair.tbl, cname);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- STEP 2: change every id / foreign-key column from uuid to text
-- ---------------------------------------------------------------------
ALTER TABLE public.users                 ALTER COLUMN id       TYPE text USING id::text;
ALTER TABLE public.addresses             ALTER COLUMN id       TYPE text USING id::text;
ALTER TABLE public.addresses             ALTER COLUMN user_id  TYPE text USING user_id::text;
ALTER TABLE public.favorites             ALTER COLUMN user_id  TYPE text USING user_id::text;
ALTER TABLE public.cart_items            ALTER COLUMN id       TYPE text USING id::text;
ALTER TABLE public.cart_items            ALTER COLUMN user_id  TYPE text USING user_id::text;
ALTER TABLE public.hamper_builder_drafts ALTER COLUMN id       TYPE text USING id::text;
ALTER TABLE public.hamper_builder_drafts ALTER COLUMN user_id  TYPE text USING user_id::text;
ALTER TABLE public.orders                ALTER COLUMN id       TYPE text USING id::text;
ALTER TABLE public.orders                ALTER COLUMN user_id  TYPE text USING user_id::text;
ALTER TABLE public.order_items           ALTER COLUMN id       TYPE text USING id::text;
ALTER TABLE public.order_items           ALTER COLUMN order_id TYPE text USING order_id::text;
ALTER TABLE public.product_addons        ALTER COLUMN id       TYPE text USING id::text;

-- ---------------------------------------------------------------------
-- STEP 3: recreate the foreign keys, now with ON UPDATE CASCADE so
-- future id renames stay in sync automatically
-- ---------------------------------------------------------------------
ALTER TABLE public.addresses
  ADD CONSTRAINT addresses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_palette_id_fkey
  FOREIGN KEY (palette_id) REFERENCES public.palette_options(id)
  ON UPDATE CASCADE;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.hamper_builder_drafts
  ADD CONSTRAINT hamper_builder_drafts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- STEP 4: one numbering sequence per table
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS users_id_seq                 OWNED BY public.users.id;
CREATE SEQUENCE IF NOT EXISTS addresses_id_seq              OWNED BY public.addresses.id;
CREATE SEQUENCE IF NOT EXISTS cart_items_id_seq              OWNED BY public.cart_items.id;
CREATE SEQUENCE IF NOT EXISTS hamper_builder_drafts_id_seq   OWNED BY public.hamper_builder_drafts.id;
CREATE SEQUENCE IF NOT EXISTS orders_id_seq                  OWNED BY public.orders.id;
CREATE SEQUENCE IF NOT EXISTS order_items_id_seq             OWNED BY public.order_items.id;
CREATE SEQUENCE IF NOT EXISTS product_addons_id_seq          OWNED BY public.product_addons.id;
CREATE SEQUENCE IF NOT EXISTS palette_options_id_seq         OWNED BY public.palette_options.id;

-- ---------------------------------------------------------------------
-- STEP 5: rename whatever rows already exist, oldest first
-- (no-op / instant if a table is currently empty)
-- ---------------------------------------------------------------------
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.users
)
UPDATE public.users u SET id = 'User-' || lpad(ranked.rn::text, 3, '0')
FROM ranked WHERE u.id = ranked.id;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.addresses
)
UPDATE public.addresses a SET id = 'Addr-' || lpad(ranked.rn::text, 3, '0')
FROM ranked WHERE a.id = ranked.id;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.cart_items
)
UPDATE public.cart_items c SET id = 'Cart-' || lpad(ranked.rn::text, 3, '0')
FROM ranked WHERE c.id = ranked.id;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.hamper_builder_drafts
)
UPDATE public.hamper_builder_drafts h SET id = 'Hamper-' || lpad(ranked.rn::text, 3, '0')
FROM ranked WHERE h.id = ranked.id;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY placed_at) AS rn FROM public.orders
)
UPDATE public.orders o SET id = 'Order-' || lpad(ranked.rn::text, 3, '0')
FROM ranked WHERE o.id = ranked.id;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM public.order_items
)
UPDATE public.order_items oi SET id = 'Item-' || lpad(ranked.rn::text, 3, '0')
FROM ranked WHERE oi.id = ranked.id;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY product_id, addon_key) AS rn FROM public.product_addons
)
UPDATE public.product_addons pa SET id = 'Addon-' || lpad(ranked.rn::text, 3, '0')
FROM ranked WHERE pa.id = ranked.id;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM public.palette_options
)
UPDATE public.palette_options p SET id = 'Palette-' || lpad(ranked.rn::text, 3, '0')
FROM ranked WHERE p.id = ranked.id;

-- ---------------------------------------------------------------------
-- STEP 6: move each sequence past however many rows were just numbered,
-- so the NEXT insert doesn't collide with an existing id
-- ---------------------------------------------------------------------
SELECT setval('users_id_seq',                GREATEST((SELECT count(*) FROM public.users), 1));
SELECT setval('addresses_id_seq',             GREATEST((SELECT count(*) FROM public.addresses), 1));
SELECT setval('cart_items_id_seq',            GREATEST((SELECT count(*) FROM public.cart_items), 1));
SELECT setval('hamper_builder_drafts_id_seq', GREATEST((SELECT count(*) FROM public.hamper_builder_drafts), 1));
SELECT setval('orders_id_seq',                GREATEST((SELECT count(*) FROM public.orders), 1));
SELECT setval('order_items_id_seq',           GREATEST((SELECT count(*) FROM public.order_items), 1));
SELECT setval('product_addons_id_seq',        GREATEST((SELECT count(*) FROM public.product_addons), 1));
SELECT setval('palette_options_id_seq',       GREATEST((SELECT count(*) FROM public.palette_options), 1));

-- ---------------------------------------------------------------------
-- STEP 7: from now on, every new row auto-generates the same style id
-- (so Backend code that doesn't send an id, like userModel.js, still
-- just works)
-- ---------------------------------------------------------------------
ALTER TABLE public.users                 ALTER COLUMN id SET DEFAULT ('User-'    || lpad(nextval('users_id_seq')::text, 3, '0'));
ALTER TABLE public.addresses             ALTER COLUMN id SET DEFAULT ('Addr-'    || lpad(nextval('addresses_id_seq')::text, 3, '0'));
ALTER TABLE public.cart_items            ALTER COLUMN id SET DEFAULT ('Cart-'    || lpad(nextval('cart_items_id_seq')::text, 3, '0'));
ALTER TABLE public.hamper_builder_drafts ALTER COLUMN id SET DEFAULT ('Hamper-'  || lpad(nextval('hamper_builder_drafts_id_seq')::text, 3, '0'));
ALTER TABLE public.orders                ALTER COLUMN id SET DEFAULT ('Order-'   || lpad(nextval('orders_id_seq')::text, 3, '0'));
ALTER TABLE public.order_items           ALTER COLUMN id SET DEFAULT ('Item-'    || lpad(nextval('order_items_id_seq')::text, 3, '0'));
ALTER TABLE public.product_addons        ALTER COLUMN id SET DEFAULT ('Addon-'   || lpad(nextval('product_addons_id_seq')::text, 3, '0'));
ALTER TABLE public.palette_options       ALTER COLUMN id SET DEFAULT ('Palette-' || lpad(nextval('palette_options_id_seq')::text, 3, '0'));

-- Verify:
-- SELECT id, name, email FROM public.users;
-- SELECT id, name FROM public.palette_options ORDER BY id;
-- SELECT id, product_id, name FROM public.product_addons ORDER BY id;
