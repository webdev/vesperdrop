-- Make stripe_events idempotency dedup retry-safe.
--
-- Previously a single processed_at column (defaulted to now() on insert)
-- meant that any partial failure mid-handler permanently lost the event:
-- the row was already there, so retries dedup-skipped without redoing the
-- work. We split "received" from "completed" so retries proceed unless the
-- prior delivery actually finished.

alter table public.stripe_events
  add column if not exists completed_at timestamptz null;

-- Backfill: every existing row was treated as "done" under the old logic,
-- so mark them complete to preserve the pre-migration behavior.
update public.stripe_events
set completed_at = processed_at
where completed_at is null;
