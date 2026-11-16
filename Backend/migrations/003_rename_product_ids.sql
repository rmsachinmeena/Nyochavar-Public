-- =====================================================================
-- Rename product IDs from slugs ('prod-rose-chocolate-hamper') to a
-- simple sequence ('Pro-001', 'Pro-002', ...). Run AFTER 001 + 002.
--
-- STEP 1 (one-time): make every foreign key that points to products(id)
-- use ON UPDATE CASCADE, so changing a product's id automatically
-- updates it everywhere that product is referenced.
-- STEP 2: a single UPDATE statement renames all product ids — thanks
-- to STEP 1, product_addons, favorites, cart_items and order_items
-- update themselves automatically, no extra queries needed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 1: add ON UPDATE CASCADE to all product_id foreign keys
-- (auto-detects the real constraint names, so it works even if Supabase
-- generated slightly different names than expected)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'products'
      AND kcu.column_name = 'product_id'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE %s',
      r.table_name,
      r.constraint_name,
      CASE WHEN r.table_name IN ('product_addons', 'favorites', 'cart_items') THEN 'CASCADE' ELSE 'NO ACTION' END
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- STEP 2: THE SINGLE QUERY — renames all 15 seeded products.
-- Because of ON UPDATE CASCADE above, this one UPDATE also silently
-- rewrites product_id in product_addons, favorites, cart_items and
-- order_items for you. Nothing else to run.
-- ---------------------------------------------------------------------
UPDATE public.products p
SET id = m.new_id
FROM (VALUES
  ('prod-rose-chocolate-hamper',   'Pro-001'),
  ('prod-heritage-journal-set',    'Pro-002'),
  ('prod-monogrammed-morning-set', 'Pro-003'),
  ('prod-celebration-grand-hamper','Pro-004'),
  ('prod-engraved-locket-keepsake','Pro-005'),
  ('prod-parisian-blush',          'Pro-006'),
  ('prod-artisan-truffle-box',     'Pro-007'),
  ('prod-eternal-romance-hamper',  'Pro-008'),
  ('prod-relax-reconnect-set',     'Pro-009'),
  ('prod-sweet-sentiments-box',    'Pro-010'),
  ('prod-midnight-toast',          'Pro-011'),
  ('prod-festive-mithai-hamper',   'Pro-012'),
  ('prod-rakhi-bond-box',          'Pro-013'),
  ('prod-marigold-mandap',         'Pro-014'),
  ('prod-bridal-trousseau',        'Pro-015')
) AS m(old_id, new_id)
WHERE p.id = m.old_id;

-- Verify:
-- SELECT id, name FROM public.products ORDER BY id;
-- SELECT product_id, name FROM public.product_addons ORDER BY product_id;
