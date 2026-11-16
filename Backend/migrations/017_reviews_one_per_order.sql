-- A customer reviews each product of a delivered order once (the "how was your gift?" popup).
-- Reviews made by the superadmin have no order_id, so they are not affected.
-- Run once in the Supabase SQL editor.

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_buyer_order_product
  ON reviews (buyer_id, order_id, product_id)
  WHERE order_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
