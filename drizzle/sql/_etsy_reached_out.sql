-- Track which Etsy candidates have been reached out to.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE etsy_candidates
  ADD COLUMN IF NOT EXISTS reached_out_at timestamptz;
