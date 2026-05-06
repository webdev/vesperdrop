-- Etsy outreach: self-contained, idempotent migration bundle.
-- Apply once against any Postgres that doesn't yet have the etsy_* tables:
--   psql "$POSTGRES_URL_NON_POOLING" -f drizzle/sql/_etsy_outreach_bundle.sql
-- Safe to re-run: every statement uses IF NOT EXISTS or DO blocks.

-- ─── Tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "etsy_candidates" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "listing_url" text NOT NULL,
  "title"       text NOT NULL,
  "image_url"   text,
  "shop_name"   text,
  "shop_url"    text,
  "category"    text,
  "description" text,
  "tags"        text[],
  "raw_md"      text NOT NULL,
  "status"      text DEFAULT 'pending' NOT NULL,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"  timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "etsy_candidates_listing_url_unique" UNIQUE ("listing_url")
);

CREATE TABLE IF NOT EXISTS "etsy_preview_pages" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "candidate_id"       uuid NOT NULL,
  "token"              text NOT NULL,
  "status"             text DEFAULT 'pending' NOT NULL,
  "source_blob_url"    text,
  "listing_snapshot"   jsonb NOT NULL,
  "hero_url"           text,
  "hero_status"        text DEFAULT 'pending' NOT NULL,
  "hero_error"         text,
  "lifestyle_url"      text,
  "lifestyle_status"   text DEFAULT 'pending' NOT NULL,
  "lifestyle_error"    text,
  "detail_url"         text,
  "detail_status"      text DEFAULT 'pending' NOT NULL,
  "detail_error"       text,
  "view_count"         integer DEFAULT 0 NOT NULL,
  "cta_click_count"    integer DEFAULT 0 NOT NULL,
  "signup_click_count" integer DEFAULT 0 NOT NULL,
  "signup_count"       integer DEFAULT 0 NOT NULL,
  "created_by"         text NOT NULL,
  "created_at"         timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"         timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at"       timestamp with time zone,
  CONSTRAINT "etsy_preview_pages_token_unique" UNIQUE ("token")
);

CREATE TABLE IF NOT EXISTS "etsy_preview_events" (
  "id"         integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "page_id"    uuid NOT NULL,
  "kind"       text NOT NULL,
  "label"      text,
  "user_agent" text,
  "ip_hash"    text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── Foreign keys ──────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "etsy_preview_pages"
    ADD CONSTRAINT "etsy_preview_pages_candidate_id_etsy_candidates_id_fk"
    FOREIGN KEY ("candidate_id") REFERENCES "public"."etsy_candidates"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "etsy_preview_events"
    ADD CONSTRAINT "etsy_preview_events_page_id_etsy_preview_pages_id_fk"
    FOREIGN KEY ("page_id") REFERENCES "public"."etsy_preview_pages"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "etsy_candidates_status_idx"
  ON "etsy_candidates" USING btree ("status");

CREATE INDEX IF NOT EXISTS "etsy_preview_pages_candidate_idx"
  ON "etsy_preview_pages" USING btree ("candidate_id");

CREATE INDEX IF NOT EXISTS "etsy_preview_pages_status_idx"
  ON "etsy_preview_pages" USING btree ("status");

CREATE INDEX IF NOT EXISTS "etsy_preview_events_page_idx"
  ON "etsy_preview_events" USING btree ("page_id");

CREATE INDEX IF NOT EXISTS "etsy_preview_events_created_idx"
  ON "etsy_preview_events" USING btree ("created_at" DESC NULLS LAST);

-- ─── Check constraints ─────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "etsy_candidates"
    ADD CONSTRAINT "etsy_candidates_status_check"
    CHECK (status IN ('pending','generating','completed','partial','failed','skipped','to_review'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "etsy_preview_pages"
    ADD CONSTRAINT "etsy_preview_pages_status_check"
    CHECK (status IN ('pending','generating','partial','completed','failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "etsy_preview_events"
    ADD CONSTRAINT "etsy_preview_events_kind_check"
    CHECK (kind IN ('view','cta_click','signup_start','signup'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Counter RPC ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_etsy_preview_counter(
  p_page_id uuid,
  p_kind text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_kind = 'view' THEN
    UPDATE etsy_preview_pages
       SET view_count = view_count + 1, updated_at = now()
     WHERE id = p_page_id;
  ELSIF p_kind = 'cta_click' THEN
    UPDATE etsy_preview_pages
       SET cta_click_count = cta_click_count + 1, updated_at = now()
     WHERE id = p_page_id;
  ELSIF p_kind = 'signup_start' THEN
    UPDATE etsy_preview_pages
       SET signup_click_count = signup_click_count + 1, updated_at = now()
     WHERE id = p_page_id;
  ELSIF p_kind = 'signup' THEN
    UPDATE etsy_preview_pages
       SET signup_count = signup_count + 1, updated_at = now()
     WHERE id = p_page_id;
  ELSE
    RAISE EXCEPTION 'unknown kind: %', p_kind;
  END IF;
END;
$$;
