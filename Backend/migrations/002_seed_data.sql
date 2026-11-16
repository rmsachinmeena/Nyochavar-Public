-- =====================================================================
-- Seed data generated from Frontend/src/data/products.ts, indianProducts.ts
-- and hamperOptions.ts. Safe to re-run (ON CONFLICT DO NOTHING).
-- Run this AFTER 001_init_schema.sql
-- =====================================================================

-- Palette options (used by Hamper Builder)
-- COMMENTED OUT: Static palette data - remove comment to restore default palettes
-- INSERT INTO public.palette_options (id, name, tagline, color_swatches, preview_image) VALUES
--   ('palette-champagne-noir', 'Imperial Noir & Sapphire', 'Imperial Moët, artisanal blue ribbon truffles, and white avalanche roses', ARRAY['#2563EB', '#1A1A1E', '#EAE6DF']::text[], 'https://lh3.googleusercontent.com/aida-public/AB6AXuBiRcBjxSzu2QZ28JdPA2Uju7MB9qwWlbOKCfYIRmc8zIS9QH0wgdobU9uqPH2zFcVOL21T09alPCJ1xJDUPIvE7FgX2lA9bBfv19NJ65l3vRV67dhTzG69uFUXwOnMvAvk4iF5NIycje4dQIq1xSmlnNSyasU-xywabkm7fh-z_Kc69z8UThioDh7Fy1m9fsyymoy1sj8Kt2f5KTBo0XaaWlcX6fZv1YRVn4raDAKz55Fa47JiDSGl'),
--   ('palette-midnight-botanical', 'Midnight Garden & Rose', 'Velvet English roses, artisan dark cocoa confections, and dry botanical gin', ARRAY['#991B1B', '#27272A', '#2563EB']::text[], 'https://lh3.googleusercontent.com/aida-public/AB6AXuBazzD-Df3Tjh7kosYNGofd3tnkQcJX7SeHNHRuEu9MWYkH_XOSH7Byw6a0yeOkgqDAHCEYrnkDCHmVzRc_qc7kjFegIaTOlYj_gS7IX5yUx0QzADhvf6TBvsdNpYCRP_prGPO74UD49kigIHEfvMu81eRdtV-AUH7Q9OnN5Y_k8opDQIdtSBRcJOq9yVsBh9bDDFp94Ms7JHjR_UtvCOjC1Jf0K-3EXm1nXlZ673RB0-tZuJebnOBu'),
--   ('palette-parisian-blush', 'Parisian Blush & Peony', 'Delicate blush peonies, salted caramel macarons, and rosewater candle', ARRAY['#F472B6', '#FDF2F8', '#3B82F6']::text[], 'https://lh3.googleusercontent.com/aida-public/AB6AXuAhad6t0zft6f-L-VNneP4WCw0RjMp8TSH2Z7KLB6oejC00K_SwLZcInVjQDCUwsjS0GHfNngTzPaOL4dlDXL4NNKP-gCgVM-gGkeHMDhhNFLifgFcFoE969KKaRWbngGKvaug9UY4j2-eAuRpYNSpdLHBc-TGx7xHm5qcmSbn00v9HPUuyqL5FqKZwdFnQeJLTjuQBSYkRH-YL19KxsDrLqllV1T7lPRsY-rYJ1H6w_sNcy5g5WB-4')
-- ON CONFLICT (id) DO NOTHING;

-- International / USD products (Flowers, Hampers, Personalized Gifts)
-- COMMENTED OUT: Static product data - add your own products via the API instead
-- INSERT INTO public.products (id, name, tagline, category, occasions, price, currency, rating, review_count, is_best_seller, is_new, image, gallery, description, hues, gender) VALUES
--   ('prod-rose-chocolate-hamper', 'Personalized Rose & Chocolate Hamper', 'Two dozen David Austin roses & artisanal Parisian truffles', 'Hampers', ARRAY['Anniversary', 'Birthday', 'Valentine''s', 'Congratulations']::text[], 145, 'USD', 4.9, 128, TRUE, FALSE, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBiRcBjxSzu2QZ28JdPA2Uju7MB9qwWlbOKCfYIRmc8zIS9QH0wgdobU9uqPH2zFcVOL21T09alPCJ1xJDUPIvE7FgX2lA9bBfv19NJ65l3vRV67dhTzG69uFUXwOnMvAvk4iF5NIycje4dQIq1xSmlnNSyasU-xywabkm7fh-z_Kc69z8UThioDh7Fy1m9fsyymoy1sj8Kt2f5KTBo0XaaWlcX6fZv1YRVn4raDAKz55Fa47JiDSGl', ARRAY['https://lh3.googleusercontent.com/aida-public/AB6AXuBiRcBjxSzu2QZ28JdPA2Uju7MB9qwWlbOKCfYIRmc8zIS9QH0wgdobU9uqPH2zFcVOL21T09alPCJ1xJDUPIvE7FgX2lA9bBfv19NJ65l3vRV67dhTzG69uFUXwOnMvAvk4iF5NIycje4dQIq1xSmlnNSyasU-xywabkm7fh-z_Kc69z8UThioDh7Fy1m9fsyymoy1sj8Kt2f5KTBo0XaaWlcX6fZv1YRVn4raDAKz55Fa47JiDSGl']::text[], 'An intimate gesture of affection. Our signature hamper features two dozen hand-selected David Austin roses, paired with artisanal truffles from our Parisian chocolatier partners. Curated to evoke warmth and celebration.', ARRAY['Blush Pink', 'Crimson Red', 'Ivory White']::text[], 'women'),
--   ... (all other products commented out)
-- ON CONFLICT (id) DO NOTHING;

-- Addons for International / USD products (Flowers, Hampers, Personalized Gifts)
-- COMMENTED OUT: Static product addons data
-- INSERT INTO public.product_addons (product_id, addon_key, name, price) VALUES
--   ... (all product addons commented out)
-- ON CONFLICT DO NOTHING;

-- Indian / INR festive products
-- COMMENTED OUT: Static Indian products data
-- INSERT INTO public.products (id, name, tagline, category, occasions, price, currency, rating, review_count, is_best_seller, is_new, image, gallery, description, hues, gender) VALUES
--   ('prod-festive-mithai-hamper', 'The Royal Mithai & Dry Fruits Hamper', 'Premium kaju katli, stuffed dates & roasted nuts in brass urli', 'Hampers', ARRAY['Diwali', 'Festivals', 'Wedding', 'Housewarming']::text[], 3500, 'INR', 4.9, 312, TRUE, FALSE, 'https://images.unsplash.com/photo-1601058269785-5b4d75b3cc2d?auto=format&fit=crop&q=80&w=1200', ARRAY['https://images.unsplash.com/photo-1601058269785-5b4d75b3cc2d?auto=format&fit=crop&q=80&w=1200']::text[], 'A traditional yet luxurious festive hamper. Handcrafted artisanal sweets, saffron-infused dates, and premium roasted nuts arranged beautifully in a reusable brass Urli.', ARRAY['Gold', 'Crimson Red', 'Marigold Yellow']::text[], 'unisex'),
--   ... (all Indian products commented out)
-- ON CONFLICT (id) DO NOTHING;

-- Addons for Indian / INR festive products
INSERT INTO public.product_addons (product_id, addon_key, name, price) VALUES
  ('prod-festive-mithai-hamper', 'diya-set', 'Set of 4 Brass Diyas', 450),
  ('prod-festive-mithai-hamper', 'saffron', 'Kashmiri Kesar 1g', 750),
  ('prod-rakhi-bond-box', 'extra-rakhi', 'Additional Lumba Rakhi', 350),
  ('prod-rakhi-bond-box', 'dry-fruits', 'Assorted Dry Fruits Potli', 500),
  ('prod-marigold-mandap', 'incense', 'Organic Sandalwood Incense', 250),
  ('prod-marigold-mandap', 'brass-bell', 'Antique Brass Puja Bell', 650),
  ('prod-bridal-trousseau', 'monogram-robe', 'Gold Thread Monogramming', 1200)
ON CONFLICT DO NOTHING;
