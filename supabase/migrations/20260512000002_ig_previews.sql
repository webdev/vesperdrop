-- IG previews: tables, indexes, check constraints, and counter RPC.
-- Combines drizzle/sql/0009_ig_previews.sql + 0010_ig_preview_counters.sql
-- so local Supabase ends up at the same schema the remote project carries.
--
-- Idempotent: IF NOT EXISTS / DROP-then-ADD on the check constraint /
-- CREATE OR REPLACE on the RPC. Safe to re-apply.

-- ─── Table: ig_previews ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ig_previews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL UNIQUE,
  title                 text,
  preset_slug           text NOT NULL,
  source_images         jsonb NOT NULL,
  preset_slugs          text[] NOT NULL,
  expected_output_count integer NOT NULL,
  notes                 text,
  status                text NOT NULL DEFAULT 'pending',
  outputs               jsonb NOT NULL DEFAULT '[]'::jsonb,
  view_count            integer NOT NULL DEFAULT 0,
  cta_click_count       integer NOT NULL DEFAULT 0,
  signup_click_count    integer NOT NULL DEFAULT 0,
  signup_count          integer NOT NULL DEFAULT 0,
  created_by            text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS ig_previews_slug_key
  ON ig_previews (slug);
CREATE INDEX IF NOT EXISTS ig_previews_created_idx
  ON ig_previews (created_at DESC);
CREATE INDEX IF NOT EXISTS ig_previews_status_idx
  ON ig_previews (status);

ALTER TABLE ig_previews
  DROP CONSTRAINT IF EXISTS ig_previews_status_check;
ALTER TABLE ig_previews
  ADD CONSTRAINT ig_previews_status_check
  CHECK (status IN ('pending','queued','generating','completed','partial','failed'));

-- ─── Table: ig_preview_events ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ig_preview_events (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  preview_id  uuid NOT NULL REFERENCES ig_previews(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  label       text,
  user_agent  text,
  ip_hash     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_preview_events_kind_check
    CHECK (kind IN ('view','cta_click','signup_start','signup'))
);

CREATE INDEX IF NOT EXISTS ig_preview_events_preview_idx
  ON ig_preview_events (preview_id);
CREATE INDEX IF NOT EXISTS ig_preview_events_created_idx
  ON ig_preview_events (created_at DESC);

-- ─── Counter RPC ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_ig_preview_counter(
  p_preview_id uuid,
  p_kind text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_kind = 'view' THEN
    UPDATE ig_previews
       SET view_count = view_count + 1, updated_at = now()
     WHERE id = p_preview_id;
  ELSIF p_kind = 'cta_click' THEN
    UPDATE ig_previews
       SET cta_click_count = cta_click_count + 1, updated_at = now()
     WHERE id = p_preview_id;
  ELSIF p_kind = 'signup_start' THEN
    UPDATE ig_previews
       SET signup_click_count = signup_click_count + 1, updated_at = now()
     WHERE id = p_preview_id;
  ELSIF p_kind = 'signup' THEN
    UPDATE ig_previews
       SET signup_count = signup_count + 1, updated_at = now()
     WHERE id = p_preview_id;
  ELSE
    RAISE EXCEPTION 'unknown kind: %', p_kind;
  END IF;
END;
$$;
