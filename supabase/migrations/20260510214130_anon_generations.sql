-- Allow anonymous generations + runs so the unauth /try funnel can
-- persist every generated image as a real DB row (instead of only
-- living in the unlock_batches.generations JSONB blob). When the
-- visitor OTP-claims the batch, /api/try/attach-batch UPDATEs the
-- now-orphan rows to point at the authed user.
--
-- Existing per-user queries already filter `where user_id = $1`, so
-- NULL rows simply don't participate. No RLS policy assumes NOT NULL.
alter table runs
  alter column user_id drop not null;

alter table generations
  alter column user_id drop not null,
  alter column run_id drop not null;

-- Cross-reference: each unlock_batches row points at the runs row
-- whose generations it owns. ON DELETE SET NULL so cleaning up an
-- expired run doesn't destroy the batch metadata (the batch row is
-- a payment receipt and may survive past the asset TTL).
alter table unlock_batches
  add column if not exists run_id uuid references runs(id) on delete set null;

create index if not exists unlock_batches_run_idx on unlock_batches (run_id);
