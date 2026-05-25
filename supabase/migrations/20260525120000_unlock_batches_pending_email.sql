-- Email-during-generation (VES-46). A /try visitor can submit their
-- email WHILE generation is still in flight — before finalize-batch has
-- written the run/generations. We stash the lowercased email on the
-- unlock_batches row (keyed by the client-minted token) and fire a
-- deferred Resend send once finalize-batch commits with succeeded tiles,
-- so the photos arrive even if the visitor closed the tab.
--
--   pending_email        — lowercased email awaiting delivery (NULL once
--                          there's nothing queued).
--   email_sent_at        — idempotency latch. Atomically flipped
--                          NULL -> now() by the winning sender so
--                          retries / duplicate submits never double-send.
--   email_send_attempts  — monotonic observability counter (how many
--                          flush attempts have run for this batch).
ALTER TABLE public.unlock_batches
  ADD COLUMN IF NOT EXISTS pending_email       TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_send_attempts INTEGER NOT NULL DEFAULT 0;
