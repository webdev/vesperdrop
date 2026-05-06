-- Add 'queued' to etsy_preview_pages.status check constraint.
-- Idempotent: drops the old constraint (if any) and re-creates with the
-- expanded value set.
--
-- Apply with:
--   psql "$POSTGRES_URL_NON_POOLING" -f drizzle/sql/_etsy_queued_status.sql

ALTER TABLE etsy_preview_pages
  DROP CONSTRAINT IF EXISTS etsy_preview_pages_status_check;

ALTER TABLE etsy_preview_pages
  ADD CONSTRAINT etsy_preview_pages_status_check
  CHECK (status IN ('pending','queued','generating','partial','completed','failed'));
