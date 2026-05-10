-- Pending "Try free" intents persisted server-side so the upload + scene
-- selection survive the user signing up on one device and confirming the
-- email on another. Keyed by lowercased email since Supabase signUp
-- returns no session pre-confirmation. consume-intent picks the latest
-- unconsumed row, marks it consumed, and returns the payload.
CREATE TABLE IF NOT EXISTS public.try_intents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  source_url       TEXT NOT NULL,
  source_name      TEXT NOT NULL,
  source_mime_type TEXT NOT NULL,
  picked_scenes    JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at      TIMESTAMPTZ
);

-- Composite index covers the consume-intent query path
-- (email = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1).
CREATE INDEX IF NOT EXISTS try_intents_email_unconsumed_idx
  ON public.try_intents (email, consumed_at, created_at DESC);
