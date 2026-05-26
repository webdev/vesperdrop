-- VES-52: enable Row Level Security on 9 public tables that were exposed
-- to the public anon key via PostgREST (`/rest/v1/<table>`).
--
-- These tables are accessed ONLY server-side:
--   * Drizzle over POSTGRES_URL connects as the `postgres` role, which
--     OWNS these tables and therefore bypasses RLS (RLS is not FORCED).
--   * `supabaseAdmin` uses the `service_role` (BYPASSRLS).
-- No browser/anon Supabase client reads or writes any of them. So enabling
-- RLS with NO policies closes the anon/authenticated REST exposure (default
-- deny) without affecting the app.
--
-- Idempotent: enabling RLS on a table that already has it is a harmless
-- no-op (this was applied to the live DB on 2026-05-26).
ALTER TABLE public.try_intents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlock_batches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anon_credits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overage_ledger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_candidates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_preview_pages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_preview_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_previews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_preview_events    ENABLE ROW LEVEL SECURITY;
