-- Add per-slot focal_point + face_box jsonb columns to etsy_preview_pages.
-- Idempotent: each ADD COLUMN uses IF NOT EXISTS.
--
-- Apply against prod with:
--   psql "$POSTGRES_URL_NON_POOLING" -f drizzle/sql/_etsy_focal_points.sql
-- Or via the Node helper used in earlier migrations.

ALTER TABLE etsy_preview_pages
  ADD COLUMN IF NOT EXISTS hero_focal_point      jsonb,
  ADD COLUMN IF NOT EXISTS hero_face_box         jsonb,
  ADD COLUMN IF NOT EXISTS lifestyle_focal_point jsonb,
  ADD COLUMN IF NOT EXISTS lifestyle_face_box    jsonb,
  ADD COLUMN IF NOT EXISTS detail_focal_point    jsonb,
  ADD COLUMN IF NOT EXISTS detail_face_box       jsonb;
