-- Hero banners: a separate phone image (1:1) and the text/button shown on the banner, all stored in the database
-- so every visitor sees what the superadmin set (before, only the admin's own browser remembered the text).
-- Run in the Supabase SQL editor. Safe to run twice.

ALTER TABLE banners ADD COLUMN IF NOT EXISTS mobile_image_url TEXT;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle         TEXT;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_text         TEXT;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS badge            TEXT;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS occasion         TEXT;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS show_overlay     BOOLEAN NOT NULL DEFAULT FALSE;
