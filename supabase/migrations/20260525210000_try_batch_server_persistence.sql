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
--     pack_role/shot_index — are unaffected.

ALTER TABLE public.unlock_batches
  ADD COLUMN IF NOT EXISTS expected_tiles INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS generations_run_preset_uidx
  ON public.generations (run_id, preset_id)
  WHERE pack_id IS NULL;
