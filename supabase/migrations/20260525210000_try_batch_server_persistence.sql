-- Server-side per-tile persistence for the /try generate flow (VES-53).
--
-- The email-during-generation promise ("we'll email you, you can safely
-- leave") only held if the visitor kept the tab open: generations were
-- persisted ONLY by the client-driven /api/try/finalize-batch call after
-- every tile settled. Closing the tab mid-generation left an unlock_batches
-- row with pending_email set but run_id NULL, so the deferred send could
-- never fire.
--
-- This migration backs the server-side fix:
--
--   unlock_batches.expected_tiles
--     Total tiles the client launched for the batch. Recorded at generation
--     START by /api/try/generate so the server can detect "every tile has
--     settled" and finalize + flush the deferred email with zero client
--     involvement. Nullable for back-compat with pre-existing batches.
--
--   generations (run_id, preset_id) unique index (pack_id IS NULL)
--     One generation row per scene per batch. Both the server tile-complete
--     write and the client finalize-batch upsert key on this so a batch can
--     never accumulate duplicate rows for the same scene (idempotency across
--     the two persistence paths). Partial on pack_id IS NULL so multi-shot
--     "complete the look" packs — which legitimately reuse a preset across
--     pack_role/shot_index — are unaffected. Historical duplicates are
--     deduped first (see the WITH ranked … DELETE below) since prod already
--     contains pre-existing double-inserts that would block index creation.

ALTER TABLE public.unlock_batches
  ADD COLUMN IF NOT EXISTS expected_tiles INTEGER;

-- Dedupe BEFORE creating the unique index.
--
-- Prod already holds historical duplicate (run_id, preset_id) pairs where
-- pack_id IS NULL — exact double-inserts (identical created_at to the
-- microsecond) from the pre-VES-53 client-only finalize path. They are
-- FK-safe to remove: verified that NOTHING references the extra rows
-- (no generations.parent_generation_id, complete_look_packs.parent_generation_id,
-- or overage_ledger.generation_id points at them), so deleting all but one
-- per partition cannot orphan a child row. Creating the index without this
-- step fails on prod ("could not create unique index ... contains duplicated
-- values").
--
-- Keep exactly ONE row per (run_id, preset_id) where pack_id IS NULL,
-- chosen deterministically so this is stable + re-runnable:
--   1. prefer status = 'succeeded'
--   2. then a row that actually has output (raw_url or output_url non-null)
--   3. then the most recent created_at
--   4. final tie-break on id (stable ordering)
-- The DELETE is a natural no-op once the table is deduped, so the whole
-- migration stays idempotent / re-runnable.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY run_id, preset_id
      ORDER BY
        (status = 'succeeded') DESC,
        ((raw_url IS NOT NULL) OR (output_url IS NOT NULL)) DESC,
        created_at DESC,
        id DESC
    ) AS rn
  FROM public.generations
  WHERE pack_id IS NULL
)
DELETE FROM public.generations g
USING ranked r
WHERE g.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS generations_run_preset_uidx
  ON public.generations (run_id, preset_id)
  WHERE pack_id IS NULL;
