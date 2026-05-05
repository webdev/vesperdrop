# Etsy outreach growth system — design spec

**Date:** 2026-05-05
**Owner:** George (gblazer@gmail.com)
**Status:** Draft for review

---

## 1. Goal

Build a private, admin-only growth system that turns curated Etsy listings into beautiful "this could be your Shopify storefront" preview pages, used as 1:1 outreach to recruit Etsy sellers onto Vesperdrop. Track preview engagement and signups end-to-end.

The visual reference is `design/screenshots/admin.png`. The image shows TWO separate surfaces side-by-side (annotated as "Example seller landing page (private link)" on the right). They render at different routes, with different audiences, and never share UI:

- **Left side** = `/admin/etsy-candidates` (admin only, internal dashboard).
- **Right side** = `/etsy-preview/[token]` (public-but-unlisted standalone landing page sent 1:1 to Etsy sellers).

The admin page never embeds the seller landing page UI. Each completed candidate row in the admin shows a small thumbnail summary, a Copy link button, and an Open preview button (opens the public route in a new tab).

Translate the reference faithfully — do not reinterpret.

---

## 2. Scope and non-goals

**In scope**
- Admin-only `/admin/etsy-candidates` page that lists candidates parsed from a markdown file, lets admins multi-select and bulk-generate Shopify-ready examples, and surfaces top-line outreach analytics.
- Background generation pipeline that produces 3 images per listing via the existing Sceneify pipeline, with bounded concurrency and retry/skip controls.
- Public-but-unlisted preview page at `/etsy-preview/[token]` matching the right side of the design reference: hero, before→after, benefits row, conversion module (email + Google), social proof, bottom note.
- GA4 events for view, CTA click, generation submitted/completed, copy-link.
- Server-side counters (Supabase) so admin metrics don't depend on GA query APIs.

**Out of scope**
- Scraping additional Etsy metadata (shop name, price, description). The MD file gives title + listing URL + image URL + category; that's all we use. Optional OG enrichment is a follow-up.
- Building out the other sidebar items in the design (Generations, Library, Batches, Discover, Settings) as functional pages. They render as visually-faithful, non-clickable stubs to match the screenshot.
- Outbound email/DM delivery. Admin copies the preview link and sends it themselves.
- Per-seller authentication on preview pages. They are unlisted (random token), `noindex`, and not in the sitemap.

---

## 3. User flow

1. Admin signs in with `gblazer@gmail.com` or `info@slavablazer.com`.
2. Admin opens `/admin/etsy-candidates`. Server parses `etsy_flat_lay_listings.md` into the `etsy_candidates` table on first load (idempotent upsert keyed on listing URL).
3. Admin reviews the table, multi-selects rows, optionally toggles mock mode, clicks **Generate selected**.
4. Server creates one `etsy_preview_pages` row per selected candidate (status `pending`) with a fresh URL-safe token, and enqueues a `processEtsyPreview` workflow per row. Concurrency is bounded by `Promise.all` over a chunked list (default 4).
5. Workflow snapshots the source image to Vercel Blob, then calls `generateViaSceneify` three times in parallel — once per pinned preset (hero, lifestyle, detail). Outputs are persisted on the preview row.
6. When the row completes, status flips to `completed` and the preview link becomes copyable in the admin table.
7. Admin copies the preview link (fires `etsy_admin_copy_preview_link`), sends to seller out-of-band.
8. Seller opens `/etsy-preview/[token]`. Page fires `etsy_preview_view`, increments server-side view counter.
9. Seller submits email or clicks Continue with Google. Click fires `etsy_preview_cta_click` and redirects into the existing `/sign-in` or `/try` flow with `?ref=etsy-preview&token=…` query for downstream attribution.
10. Trial-start attribution: existing checkout-success-tracker reads the `vd_etsy_ref` cookie and increments `signup_count` on the preview row.

---

## 4. Architecture

### 4.1 Routes

| Route | Type | Auth | Notes |
|---|---|---|---|
| `/admin/etsy-candidates` | Server component | Admin only | Sidebar + table + metrics. Each completed row shows thumbnail summary + Copy link + Open preview (new tab to `/etsy-preview/[token]`). Admin page never embeds the seller-facing UI. |
| `/api/admin/etsy/ingest` | POST | Admin only | Re-parses the MD file, upserts candidates |
| `/api/admin/etsy/generate` | POST | Admin only | Body: `{ candidateIds: string[], mock: boolean }` — enqueues |
| `/api/admin/etsy/retry` | POST | Admin only | Body: `{ pageId: string }` — re-enqueues a failed/skipped page |
| `/api/admin/etsy/skip` | POST | Admin only | Body: `{ candidateIds: string[] }` — marks candidates skipped |
| `/etsy-preview/[token]` | Server component | Public unlisted | `noindex`; not in sitemap |
| `/api/public/etsy-preview/[token]/event` | POST | Public, rate-limited | Body: `{ kind: 'cta_click' \| 'signup_start', label?: string }` (views are recorded server-side on render, not via this endpoint) |

### 4.2 Modules

```
src/
  app/
    (admin)/                          # route group with shared admin layout
      layout.tsx                      # top Nav + left sidebar shell
      admin/
        etsy-candidates/
          page.tsx                    # server: parse MD, render table + metrics
          candidates-table.tsx        # client: selection + bulk actions
          metrics-cards.tsx           # server: read counters
          top-previews.tsx            # server: top-performing list
    etsy-preview/
      [token]/
        page.tsx                      # server: render preview, increment view
        opengraph-image.tsx           # OG image (first generated image)
        cta-form.tsx                  # client: email + Google buttons, fires events
    api/
      admin/etsy/
        ingest/route.ts
        generate/route.ts
        retry/route.ts
        skip/route.ts
      public/etsy-preview/[token]/event/route.ts

  lib/
    etsy-outreach/
      parse-md.ts                     # tolerant markdown parser
      parse-md.test.ts
      candidates.ts                   # DB ops on etsy_candidates
      pages.ts                        # DB ops on etsy_preview_pages
      events.ts                       # DB ops on etsy_preview_events + counters
      tokens.ts                       # generatePreviewToken()
      presets.ts                      # pinned Sceneify preset slugs
      analytics.ts                    # named GA4 event constants
    workflows/
      process-etsy-preview.ts         # "use workflow" mirror of process-run
```

### 4.3 Data flow

```
MD file ─► parse-md.ts ─► etsy_candidates (upsert by listing URL)
                              │
                              ▼
                     admin selects + clicks Generate
                              │
                              ▼
              etsy_preview_pages (pending, with token)
                              │
                              ▼
            processEtsyPreview workflow (per row)
                              │
                              ├─► snapshot Etsy image → Vercel Blob
                              │
                              └─► Promise.all over 3 presets
                                       │
                                       ▼
                          generateViaSceneify (existing)
                                       │
                                       ▼
                          update preview row (urls + status)
                              │
                              ▼
              admin copies link → seller views → events table
                              │
                              ▼
              counters on etsy_preview_pages (views, ctas, signups)
```

---

## 5. Markdown ingestion

`etsy_flat_lay_listings.md` is parsed server-side. Tolerant rules:

- Blocks are separated by `## N. [Title](listing-url)` headings.
- The image URL is the first `![alt](url)` after the heading.
- Category is the trailing `_Surfaced via search: <category>_` line if present.
- Anything missing is recorded as `null` and the row keeps the raw block in `raw_md` for debugging.
- Parse errors on a single block are caught and logged; the rest of the file ingests successfully.

The parser returns `{ candidates: ParsedCandidate[]; errors: ParseError[] }`. Ingestion upserts on `listing_url` (unique constraint).

The MD file path is wrapped behind `lib/etsy-outreach/source.ts` so we don't leak the absolute developer path. In production we'll either bundle the MD into the repo at `data/etsy-candidates.md` or read from `ETSY_CANDIDATES_PATH` env var. Default path: `data/etsy-candidates.md`. (The current absolute path under `~/Documents` is dev-only.)

---

## 6. Generation pipeline

### 6.1 Workflow

`src/lib/workflows/process-etsy-preview.ts`:

```ts
"use workflow";

export async function processEtsyPreview(pageId: string, mock = false) {
  const page = await loadPreviewPage(pageId);                     // "use step"
  const sourceUrl = await snapshotSourceImage(page);              // "use step"

  const presets = ["shopify-hero", "lifestyle", "detail"] as const;
  const results = await Promise.all(
    presets.map((slug) => generateOnePreset(pageId, sourceUrl, slug, mock))
  );

  await markCompleted(pageId, results);                           // "use step"
}
```

Each `generateOnePreset` step:
- Sets the per-slot status to `running`.
- Calls `generateViaSceneify({ sourceUrl, presetSlug, model: "gpt-image-2", quality: "high", callerRef: pageId })`.
- Persists `output_url` and `model_used`.
- On error, persists `error` and the slot becomes `failed`. Other slots continue.

A page is `completed` when all three slots succeed, `partial` if at least one succeeds, `failed` if all three fail.

### 6.2 Concurrency

- `/api/admin/etsy/generate` chunks `candidateIds` into groups of `ETSY_GENERATION_CONCURRENCY` (default `4`) and runs each chunk via `Promise.all` of `processEtsyPreview` invocations. Subsequent chunks start when the prior chunk's promises resolve.
- Within a single page, the three preset generations run concurrently via `Promise.all`.
- This bounds Sceneify load at roughly `concurrency × 3` in-flight requests.

### 6.3 Mock mode

- Honors `MOCK_GENERATION === "1"` env (matches existing `process-run.ts` style).
- Admin UI also exposes a "Mock mode" checkbox in the generate dropdown that overrides per-batch.
- Mock mode skips Sceneify and writes the source URL into all three slots after a 10–15s simulated delay (mirrors existing `generateMock`).

### 6.4 Retries / skip

- "Retry failed" action re-enqueues the workflow for the page, resetting failed slots to `pending`.
- "Mark skipped" sets candidate status to `skipped` and does not create a preview page.

---

## 7. Preview page

### 7.1 Route

`/etsy-preview/[token]`

- Token: 32 random bytes, URL-safe base64 (43 chars), generated via `crypto.randomBytes(32).toString("base64url")`. Not derived from any seller-identifying input. Lookup is by token only — no enumeration possible.
- Page is rendered server-side from the preview row's denormalized `listing_snapshot` (title, listing URL, image URL, shop name, category). The seller-facing route NEVER joins to `etsy_candidates`, so it cannot accidentally leak the candidate list or other rows.
- `<meta name="robots" content="noindex,nofollow" />` plus `X-Robots-Tag: noindex, nofollow` response header. Excluded from `sitemap.ts`.
- 404 (not 403) if the token doesn't match a `completed` or `partial` row.
- A `view` event is recorded server-side on render (deduped per session via a short-lived cookie to avoid inflating counters on refresh).
- The page never exposes admin controls, candidate IDs in markup, or any UI hint of other previews.

### 7.2 Sections (matching `design/screenshots/admin.png` right side)

1. **Header.** Existing Vesperdrop wordmark left; on the right a small italic note "Example seller landing page · private link".
2. **Hero.** Serif headline `Hi there, this is what your product could look like on Shopify.` with `your product` wrapped in a span styled with the warm orange accent (`--accent` / terracotta). Subtext: "We created these examples from your Etsy listing to help you visualize the possibilities."
3. **Before → after.** Original Etsy image card on the left (with title, "Etsy listing" pill, link). Arrow glyph. Three generated images in a row to the right, each rounded card.
4. **Benefits row.** 4 columns: Shopify ready · Lifestyle focused · Higher conversions · Save time & money. Tiny line icon, small title, muted descriptor.
5. **Conversion module.** Card with serif heading `Ready to create your own stunning images?`, subtext "Join Vesperdrop and transform your products in minutes.", email input + `Start your free trial` CTA, divider, `Continue with Google` button. Trust points underneath: 7-day free trial · Cancel anytime · No credit card required. Avatar stack + "Join thousands of Etsy sellers growing with Vesperdrop."
6. **Bottom note.** Centered muted text: `This is a private preview made just for you by Vesperdrop.`

### 7.3 CTA wiring

- **Email submit** → fires `etsy_preview_cta_click` (`label: email_submit`) AND `etsy_preview_signup_start` (`method: email`), POSTs both as server events to `/api/public/etsy-preview/[token]/event`, then navigates to `/sign-in?ref=etsy-preview&token=…&email=…`.
- **Continue with Google** → fires `etsy_preview_cta_click` (`label: google`) AND `etsy_preview_signup_start` (`method: google`), then triggers existing Supabase Google OAuth flow with `ref=etsy-preview&token=…` in the redirect.
- A 30-day `vd_etsy_ref` cookie is set on first preview load with `{ token, candidate_id }`. The downstream `checkout.session.completed` (existing Stripe success path) reads this cookie and attributes the completed signup back to the preview row by incrementing `signup_count`.
- The seller-facing page never reads or writes any other ref/cookie namespace; this isolates Etsy outreach attribution from organic signup tracking.

---

## 8. Admin UI

### 8.1 Layout

The `(admin)` route group uses a layout that:
- Renders the global top `Nav` (so admins still see their account/credits).
- Renders a left sidebar below it matching the screenshot.
- Constrains the main column to a comfortable max-width with editorial spacing per CLAUDE.md.

Sidebar items:

| Item | State | Target |
|---|---|---|
| Etsy candidates | active | `/admin/etsy-candidates` |
| Generations | stub, muted | `#` (cursor: default, aria-disabled) |
| Library | stub | `#` |
| Batches | stub | `#` |
| Discover | stub | `#` |
| Settings | stub | `#` |

A small "Coming soon" badge appears next to stubs.

### 8.2 Candidates table

Columns (matching design):
- Checkbox
- Listing preview image (square thumb, rounded, ~48px)
- Listing title (truncate to 1 line)
- Shop name (or em-dash when null)
- Status pill (Pending / Generating / Completed / Failed / Skipped / To review)
- Preview link button (visible when `completed` or `partial`; copies to clipboard, fires `etsy_admin_copy_preview_link`)
- Updated time (relative)
- Actions menu (Generate, Retry, Mark skipped, Open original Etsy listing)

Top controls:
- "Bulk actions" dropdown (Generate selected · Retry failed · Mark skipped · Mock mode toggle).
- "Generate selected" primary button (dark bg, light text; matches existing primary button style).

Status pills (muted only):
| Status | Color treatment |
|---|---|
| Pending | neutral surface, `--ink-3` text |
| Generating | amber-tinted surface, amber-700 text |
| Completed | sage-tinted surface, green-700 text |
| Partial | sage with subtle warning dot |
| Failed | rose-tinted surface, rose-700 text |
| Skipped | `--surface`, `--ink-3` text |
| To review | cream with `--ink-2` text |

### 8.3 Performance section (bottom of admin page)

Two side-by-side panels matching the screenshot:

- **Recent performance**: 4 stat tiles — total previews, total views, CTA clicks, conversion rate. Each tile has a serif number and a small label.
- **Top performing previews**: list of the top 5 preview rows by view count, each with thumbnail, title, view count, click count.

Numbers are computed server-side from `etsy_preview_pages` counters and `etsy_preview_events`.

---

## 9. Database schema

New tables (Drizzle migration in `drizzle/sql/`):

```sql
-- etsy_candidates
create table etsy_candidates (
  id              uuid primary key default gen_random_uuid(),
  listing_url     text not null unique,
  title           text not null,
  image_url       text not null,
  shop_name       text,
  shop_url        text,
  category        text,
  description     text,
  tags            text[],
  raw_md          text not null,
  status          text not null default 'pending'
                    check (status in ('pending','generating','completed','partial','failed','skipped','to_review')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- etsy_preview_pages
create table etsy_preview_pages (
  id              uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references etsy_candidates(id) on delete cascade,
  token             text not null unique,
  status            text not null default 'pending'
                      check (status in ('pending','generating','partial','completed','failed')),
  source_blob_url   text,                              -- our blob snapshot of Etsy image
  listing_snapshot  jsonb not null,                    -- denormalized seller-facing data: { title, listing_url, image_url, shop_name, category }
  hero_url          text,
  hero_status       text not null default 'pending',
  hero_error        text,
  lifestyle_url     text,
  lifestyle_status  text not null default 'pending',
  lifestyle_error   text,
  detail_url        text,
  detail_status     text not null default 'pending',
  detail_error      text,
  view_count        int  not null default 0,
  cta_click_count   int  not null default 0,
  signup_click_count int not null default 0,
  signup_count      int  not null default 0,           -- attributed completed signups (Stripe webhook)
  created_by        text not null,                     -- admin email
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index etsy_preview_pages_candidate_idx on etsy_preview_pages(candidate_id);
create index etsy_preview_pages_status_idx on etsy_preview_pages(status);

-- etsy_preview_events (raw event log; counters above are denormalized)
create table etsy_preview_events (
  id          bigserial primary key,
  page_id     uuid not null references etsy_preview_pages(id) on delete cascade,
  kind        text not null check (kind in ('view','cta_click','signup_start','signup')),
  label       text,
  user_agent  text,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index etsy_preview_events_page_idx on etsy_preview_events(page_id);
create index etsy_preview_events_created_idx on etsy_preview_events(created_at desc);
```

Counter increments happen via Supabase RPC (`increment_etsy_preview_counter(page_id, kind)`) so they're atomic. Reading the dashboard reads from the denormalized counters, not the events table.

---

## 10. Analytics

### 10.1 GA4 events

All preview-page events share a common params shape:

```ts
type EtsyPreviewEventParams = {
  preview_token: string;
  candidate_id: string;
  seller_name: string | null;   // shop_name from listing_snapshot, may be null
  listing_url: string;
  source: "etsy_outreach";
};
```

| Event name | Fires from | Additional properties |
|---|---|---|
| `etsy_preview_view` | preview page mount (client) | — (uses common shape) |
| `etsy_preview_cta_click` | preview page CTA buttons | `label`: `email_submit` \| `google` \| `start_trial` |
| `etsy_preview_signup_start` | seller leaves preview into `/sign-in` or OAuth, before account exists | `method`: `email` \| `google` |
| `etsy_admin_generation_submitted` | admin generate action | `count`, `mock` |
| `etsy_admin_generation_completed` | preview row reaches terminal status (client SWR poll) | `page_id`, `status` |
| `etsy_admin_copy_preview_link` | admin copy action | `page_id`, `preview_token` |

Events use the existing `track()` helper in `src/lib/analytics.ts`. No PII in props (no email addresses, no IPs).

### 10.2 Server-side counters

- **View**: server-side increment on preview page render (deduped per session cookie). Also writes a row to `etsy_preview_events`.
- **CTA click**: POST `/api/public/etsy-preview/[token]/event` with `{ kind: 'cta_click', label }`. Increments `cta_click_count`. Rate-limited to 10/min/IP via existing rate-limit infra.
- **Signup start**: same endpoint with `{ kind: 'signup_start', label }` fired when the seller transitions from preview → `/sign-in` or OAuth. Increments `signup_click_count`.
- **Signup (completed)**: when `checkout.session.completed` (Stripe webhook) finds the `vd_etsy_ref` token cookie, increments `signup_count`. This is the bottom-of-funnel attribution.

The admin dashboard reads only the denormalized counters; this keeps the metrics tiles fast and decoupled from GA's query latency.

---

## 11. Security

- Both admin emails gate `/admin/*`, `/api/admin/*` via existing `isAdminEmail()` + Supabase server session. Non-admin: 404 (so we don't reveal the route).
- Preview pages: public unlisted with random token. `noindex,nofollow`. Excluded from `sitemap.ts`.
- The MD source file is read server-side only; the absolute path is not exposed in API responses or client bundles.
- Etsy images are hot-linked from `i.etsystatic.com` (no rehosting of original art). The generated images we own.
- Rate-limit `/api/public/etsy-preview/[token]/event` to discourage counter inflation. Hash IPs before storage.
- CSRF: admin POST routes require Supabase session cookie (same-origin); the public events endpoint is intentionally CSRF-tolerant (idempotent counter increments only).

---

## 12. Visual fidelity rules (from CLAUDE.md)

- All admin and preview pages must be centered, max-width constrained.
- Tight editorial spacing.
- Serif for display (page titles, hero headlines, conversion heading); sans for body.
- Status pills muted only. No saturated colors.
- Buttons: dark primary (`bg-ink`), terracotta accent reserved for the hero word "your product" and the social-proof avatar ring (sparingly).
- Images dominate; no uniform thumbnail grids on the preview page (the three generated cards already create hierarchy via composition).
- No new layout systems; reuse `Container`, `PageShell` patterns where they exist.

---

## 13. Implementation order

1. DB migrations (`etsy_candidates`, `etsy_preview_pages`, `etsy_preview_events`, RPC for counters).
2. `lib/etsy-outreach/parse-md.ts` + tests against the real MD file.
3. `lib/etsy-outreach/{candidates,pages,events,tokens,presets,source}.ts`.
4. `lib/workflows/process-etsy-preview.ts` (mock + real branches).
5. `(admin)` layout shell, sidebar, admin gating in layout.
6. `/admin/etsy-candidates` page + candidates table client component.
7. Admin API routes: ingest, generate, retry, skip.
8. Public event API + counter RPC.
9. `/etsy-preview/[token]` page sections (hero, before/after, benefits, conversion, footer).
10. CTA wiring + signup attribution cookie + Stripe webhook hook.
11. Admin metrics tiles + top-performing list.
12. GA4 event constants + `track()` calls at all sites.
13. Nav `Admin` link (admin-only).
14. QA: admin gating, mock generation, real generation in dev with one row, preview rendering, mobile, signup flow.

---

## 14. Risks and TODOs

- **Sceneify preset coverage.** Pinned slugs `shopify-hero`, `lifestyle`, `detail` are placeholders. Before implementation, run `sceneify().listPresets()` against staging and pick three that read as Shopify hero / lifestyle / product detail. Document chosen slugs in `lib/etsy-outreach/presets.ts` and add a fallback to nearest-matching preset.
- **MD file location in prod.** Currently lives in `~/Documents/Claude/Projects/Darkroom/etsy_flat_lay_listings.md`. Plan: copy into `data/etsy-candidates.md` checked into the repo, or set `ETSY_CANDIDATES_PATH`. Not for the public bundle — server-only read.
- **Hot-linking Etsy CDN.** Etsy CDN URLs sometimes 403 on referrer mismatch. The source-image snapshot to Vercel Blob (step 1 of the workflow) protects the generated assets, but the "before" thumbnail on the preview page hot-links Etsy. If we see breakage, mirror the source image to Blob and use that for both the snapshot input and the displayed before-thumbnail.
- **Sidebar stubs.** Confirmed approach: render visually-faithful but non-clickable stubs for Generations/Library/Batches/Discover/Settings. If we later build any of these, they get a real route.
- **Generation completion event timing.** GA4's `etsy_admin_generation_completed` fires from a client poll; if the admin closes the tab before completion, the event is missed. The server-side `completed_at` timestamp is the source of truth for the dashboard regardless.
- **Signup attribution cookie collision.** Existing onboarding may already use `ref=` cookies. Namespace this one as `vd_etsy_ref` to avoid clobbering.
- **Mobile.** Preview page must collapse the three-image row to a horizontal scroll or stacked cards. Spec'd visually in §7.2 but worth a pass during QA.

---

## 15. Acceptance criteria

- Non-admin hitting `/admin/etsy-candidates` returns 404.
- Admin can ingest the MD file, see all candidates as `pending`, multi-select 3, click Generate (mock mode) and see all 3 reach `completed` within ~30s.
- Each completed row produces a `/etsy-preview/[token]` page that renders the hero, before/after, benefits, conversion module, and bottom note in the order shown in the design.
- Submitting the email field on the preview page navigates to `/sign-in?ref=etsy-preview&token=…&email=…` and fires `etsy_preview_cta_click`.
- Visiting the preview page increments `view_count`; submitting the CTA increments `cta_click_count`; transitioning to sign-in/OAuth increments `signup_click_count`. All three reflect in the admin metrics tiles within one refresh.
- The seller-facing route at `/etsy-preview/[token]` queries only the preview row by token. It never reads `etsy_candidates` directly. Verified by code inspection.
- Preview pages return `noindex` headers and are not in `sitemap.xml`.
- Bottom admin metrics row shows the four stat tiles and top-5 list as in the screenshot.

---
