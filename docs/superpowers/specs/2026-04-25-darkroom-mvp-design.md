# Darkroom MVP — design

**Date:** 2026-04-25
**Status:** Approved (pending implementation plan)

## Goal

Stand up the Darkroom website end-to-end against a Docker'd Sceneify instance, runnable locally with one command. Customer-facing surface (marketing, auth, billing, upload→generate→view flow) lives entirely in Darkroom; image generation is delegated to Sceneify's existing REST API.

## Division of labor

- **Sceneify (Docker, `:8080`)** — pure generation engine. Owns: vision-prompt construction, fal.ai calls, source upload, generation persistence (its own JSON file db), preset registry. Exposes existing routes:
  - `POST /api/sources` (multipart `file`) → `{ source: { id, url, ... } }`
  - `GET /api/presets` → `{ presets: Preset[] }`
  - `POST /api/generations` body `{ sourceId, presetId, model }` → `{ generation }`
  - `GET /api/generations/:id` → `{ generation }`
- **Darkroom (Next.js, `:3000`)** — everything customer-facing. Owns: marketing site, auth, billing, run/generation rows for users, watermark composition for free tier, usage gating, plan configuration.

## Product surface

| Route                        | Auth | Purpose                                                                  |
| ---------------------------- | ---- | ------------------------------------------------------------------------ |
| `/`                          | —    | Marketing site (hero, how-it-works, pricing CTA)                         |
| `/sign-in`, `/sign-up`       | —    | Supabase email + Google OAuth                                            |
| `/pricing`                   | —    | Free vs Pro plan + Stripe Checkout entry point                           |
| `/app`                       | yes  | Upload N source photos → pick M presets → generate → view N×M results    |
| `/app/runs/:id`              | yes  | Single run results grid                                                  |
| `/account`                   | yes  | Plan status, usage this month, manage subscription, sign out             |
| `/api/runs`                  | yes  | POST: orchestrate N×M generations against Sceneify                       |
| `/api/runs/:id`              | yes  | GET: status (polled by client)                                           |
| `/api/stripe/checkout`       | yes  | Create Stripe Checkout session                                           |
| `/api/stripe/portal`         | yes  | Create Stripe Customer Portal session                                    |
| `/api/stripe/webhook`        | —    | Subscription state sync (signed)                                         |

Each authed route gets an `error.tsx` boundary per CLAUDE.md.

## Plan model (configurable)

All plan parameters live in `lib/env.ts` and are read at runtime. No hardcoded limits.

```ts
PLAN_FREE_MONTHLY_GENERATIONS  // e.g. 10
PLAN_FREE_WATERMARK            // boolean, default true
PLAN_PRO_PRICE_USD             // e.g. 20
PLAN_PRO_MONTHLY_GENERATIONS   // 0 = unlimited
PLAN_PRO_WATERMARK             // boolean, default false
STRIPE_PRO_PRICE_ID            // Stripe price ID for the Pro plan
```

Free-tier users hit `PLAN_FREE_MONTHLY_GENERATIONS` per `usage_monthly` row → `/api/runs` returns 402 with an upgrade prompt. Watermark applied based on the user's plan flag at the moment of generation.

## Architecture

```
Browser ─► Darkroom (Next.js, :3000)
              │
              ├── Supabase (auth, app data) [local stack on :54321 in dev]
              ├── Stripe (subscriptions + portal + webhook) [test mode in dev]
              └── Sceneify (Docker, :8080)
                      ├── POST /api/sources
                      ├── GET  /api/presets
                      └── POST /api/generations
```

### Source reuse

When a user uploads N photos and picks M presets, Darkroom uploads each photo to Sceneify exactly once and reuses the returned `source.id` across all M preset generations for that photo. Source IDs returned by Sceneify are stored in the Darkroom `generations` row alongside our own row id.

### Fan-out (durable, queue-backed from day one)

Generation work is long (single Sceneify call can take 30–120s; an N×M run is much longer) and serverless functions are not the right place to keep that work alive. Use **Vercel Workflow DevKit (WDK)** so the orchestration is durable, retryable, observable, and identical between local dev and production.

`POST /api/runs` body: `{ sourceFileIds: Blob[], presetIds: string[] }`. The route:

1. Verifies user, checks usage cap (atomic `UPDATE ... WHERE generation_count + N <= cap RETURNING ...` — no TOCTOU).
2. Creates a `runs` row and N×M `generations` rows in `pending`.
3. Triggers a `processRun` workflow with `{ runId }` and returns `{ runId }` immediately.
4. Returns 200 to the browser; client polls `GET /api/runs/:id` every 2.5s.

The `processRun` workflow (in `lib/workflows/process-run.ts`) is a typed, step-based DAG:

- `step("upload-sources", ...)` — uploads each user blob to Sceneify once, stores `sceneify_source_id` on every generation row that uses it. Idempotent: if a source already has a `sceneify_source_id`, skip.
- `step.parallel("generate-*", ...)` for each `(sourceId, presetId)` pair — one step per generation, all in parallel. Each step calls Sceneify, writes status + `sceneify_generation_id` + `output_url`. WDK handles retries with exponential backoff on 5xx/network failures, no retries on 4xx.
- `step.parallel("watermark-*", ...)` for any rows where the user's plan flag requires it — fetches Sceneify output, composites watermark via `lib/watermark.ts`, uploads to Vercel Blob, replaces `output_url`. Skipped entirely for Pro users.
- `step("finalize", ...)` — marks the run complete and increments `usage_monthly` by the count of `succeeded` generations (NOT total — failed generations don't count against the cap).

Each step is idempotent and writes its result to Postgres before returning, so a retried step never double-charges or double-uploads. WDK persists step state, so a worker crash mid-run resumes from the last completed step.

Client polling reads from the `generations` table directly via `GET /api/runs/:id`; the workflow drives the rows, the API surface just exposes them.

**Why WDK over alternatives:**
- vs. Vercel Queues: WDK gives us typed steps, parallel fan-out, and resumability built-in; Queues would require us to hand-roll the DAG.
- vs. in-process `Promise.all` in the route: doesn't survive serverless function timeouts; can't resume after a crash; can't observe individual step state.
- vs. BullMQ + Redis: extra infra to run locally and in prod; WDK is native to the platform we're already on.

### Watermarking

Diagonal stripe text "DARKROOM PREVIEW" + the username, semi-transparent, repeated across the image. Implemented in `lib/watermark.ts` using `sharp`. Output stored in Vercel Blob in production; in local dev, written to `./public/watermarked/` and served from Darkroom.

## Data model (Supabase Postgres)

```sql
profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text unique,
  plan text not null default 'free' check (plan in ('free','pro')),
  plan_renews_at timestamptz,
  created_at timestamptz default now()
)

runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source_count int not null,
  preset_count int not null,
  total_images int not null,
  created_at timestamptz default now()
)

generations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  sceneify_source_id text not null,
  sceneify_generation_id text,
  preset_id text not null,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed')),
  output_url text,
  watermarked boolean not null default false,
  error text,
  created_at timestamptz default now(),
  completed_at timestamptz
)

usage_monthly (
  user_id uuid not null references profiles(id) on delete cascade,
  year_month text not null,             -- e.g. '2026-04'
  generation_count int not null default 0,
  primary key (user_id, year_month)
)

stripe_events (
  id text primary key,                  -- Stripe event id; dedup key
  type text not null,
  processed_at timestamptz default now()
)

rate_limits (
  user_id uuid not null references profiles(id) on delete cascade,
  bucket text not null,                 -- e.g. 'runs'
  tokens int not null,
  refilled_at timestamptz not null,
  primary key (user_id, bucket)
)
```

Row-level security: every table is `user_id = auth.uid()`. `profiles` self-row only.

A trigger on `auth.users` insert creates the matching `profiles` row.

## Image storage

- **Sceneify side:** runs in Docker without `BLOB_READ_WRITE_TOKEN` for local dev → writes to its container's `./public/uploads/` and serves at `http://localhost:8080/uploads/...`. Darkroom stores those URLs verbatim in `generations.output_url` and the browser fetches them directly from Sceneify.
- **Darkroom side (watermarked images, prod images):** Vercel Blob in prod via `BLOB_READ_WRITE_TOKEN`. In local dev, fall back to `./public/watermarked/`.

`next.config.ts` whitelists `localhost:8080` and the Vercel Blob domain in `images.remotePatterns`.

## Stack & libraries

Per Darkroom CLAUDE.md (locked):

- Next.js 16 App Router, TypeScript strict, Tailwind, shadcn/ui, pnpm
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- Stripe (`stripe` SDK + `@stripe/stripe-js` for client)
- Vercel Blob (`@vercel/blob`)
- Vercel Workflow DevKit (`workflow`) — durable orchestration of generation runs
- `sharp` for watermark composition
- `zod` for schema validation, schemas in `lib/schema/`
- Vitest + Playwright for tests

Not used in this iteration: `@fal-ai/client` (Sceneify owns it), AI Gateway / `ai` SDK (Sceneify owns it), PostHog (deferred).

## Module layout

```
app/
  (marketing)/page.tsx, pricing/page.tsx
  (auth)/sign-in, sign-up
  (app)/app/page.tsx, app/runs/[id]/page.tsx, account/page.tsx
  api/runs/route.ts, api/runs/[id]/route.ts
  api/stripe/checkout/route.ts, portal/route.ts, webhook/route.ts
  api/workflows/[...slug]/route.ts   # WDK runtime endpoint
components/
  ui/                      shadcn primitives
  app/                     Darkroom feature components (UploadDropzone, PresetPicker, RunGrid, ...)
  marketing/               landing page sections
lib/
  env.ts                   typed env accessor + plan config
  supabase/                client, server, middleware helpers
  stripe/                  client + webhook handler
  sceneify/                typed REST client (sources, presets, generations)
  db/                      typed query helpers (runs, generations, usage)
  workflows/               WDK definitions; process-run.ts entry workflow
  watermark.ts             sharp pipeline
  schema/                  zod schemas shared client/server
middleware.ts              Supabase session refresh + auth gate for /app, /account
```

`import "server-only"` at the top of `lib/sceneify/`, `lib/db/`, `lib/stripe/`, `lib/watermark.ts`.

## Local dev tooling

The MVP must come up with a small, well-documented set of commands.

### Required external state

- **Sceneify** in Docker on `:8080` (user-managed Dockerfile; this spec assumes it's running and reachable).
- **Supabase local stack** via Supabase CLI (`supabase start` → Postgres on `:54322`, Auth + Studio on `:54321`).
- **Stripe CLI** in test mode (`stripe listen --forward-to localhost:3000/api/stripe/webhook`).

### Scripts in `package.json`

```
pnpm dev              # next dev only
pnpm dev:all          # concurrently: next dev + stripe webhook listener
pnpm db:start         # supabase start
pnpm db:stop          # supabase stop
pnpm db:migrate       # supabase migration up (local)
pnpm db:reset         # supabase db reset (drops + reseeds)
pnpm stripe:listen    # stripe listen --forward-to ...
pnpm test             # vitest
pnpm test:e2e         # playwright
pnpm lint             # eslint + tsc --noEmit
```

### Setup doc (`docs/setup.md`)

A single page covering one-time setup:

1. Install pnpm, Docker, Supabase CLI, Stripe CLI.
2. `cp .env.local.example .env.local` and fill in keys (Supabase anon, Stripe test, Sceneify URL, plan config).
3. `pnpm install`.
4. `pnpm db:start && pnpm db:migrate`.
5. Start Sceneify in Docker.
6. `pnpm dev:all`.
7. `stripe trigger checkout.session.completed` to verify webhook.

### Env vars (`.env.local.example`)

```
# Sceneify
SCENEIFY_API_URL=http://localhost:8080

# Supabase (local)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRO_PRICE_ID=price_...

# Plan config (pick numbers later — these are placeholders)
PLAN_FREE_MONTHLY_GENERATIONS=10
PLAN_FREE_WATERMARK=true
PLAN_PRO_PRICE_USD=20
PLAN_PRO_MONTHLY_GENERATIONS=0
PLAN_PRO_WATERMARK=false

# Throughput guards
MAX_RUN_IMAGES=60                   # max N*M per run
RUNS_PER_MINUTE_PER_USER=3          # rate limit on POST /api/runs

# Vercel Blob (optional locally)
BLOB_READ_WRITE_TOKEN=
```

## Error handling

- Every authed page: `error.tsx` boundary.
- `lib/sceneify/` client: typed errors (`SceneifyUnreachable`, `SceneifyValidation`, `SceneifyTimeout`); retry with exponential backoff (3 attempts) on 5xx + network errors only, NOT on 4xx.
- Per-generation failure: row marked `failed` with `error`, run continues for the rest. Run page shows partial results + retry per cell.
- Stripe webhook: idempotent on `event.id`. Replay-safe.

## Testing

- **Unit (Vitest)**: plan-config gating logic, watermark pipeline, Sceneify client (mocked HTTP), Stripe webhook handler (signed fixture events).
- **e2e (Playwright)**: smoke test that exercises sign-up → upload → generate (against a stubbed `SCENEIFY_API_URL` that returns canned responses) → see results. Runs in CI without Sceneify or Stripe.
- **Manual checklist**: stripe webhook end-to-end with `stripe trigger`, real Sceneify generation, free-tier cap enforcement, plan upgrade flow.

## Scalability

The MVP must work on a laptop with one user, but every shape decision below is chosen so we don't have to rewrite when usage grows. Concrete commitments:

**Stateless web tier.** Every Next.js route is stateless; all state is in Postgres, Vercel Blob, or the WDK runtime. Horizontal scale = increase Vercel concurrency, no app-level changes.

**Long work never lives in HTTP requests.** Generation orchestration is in WDK workflows from day one (see Fan-out section). HTTP routes are short, fast, and crash-safe. No `Promise.all` in a route, no `setTimeout`, no in-memory queues.

**Idempotency everywhere external.**
- Sceneify source upload: keyed by Darkroom's source row id; if `sceneify_source_id` is already present, skip.
- Stripe webhook: dedupe on `event.id` via a `stripe_events (id, processed_at)` table. Replay-safe.
- Workflow steps: each writes its result to Postgres before returning, so retries don't double-charge users or double-upload images.

**Atomic usage gating.** Free-tier cap enforced in a single SQL statement (`UPDATE usage_monthly SET generation_count = generation_count + N WHERE ... AND generation_count + N <= cap RETURNING ...`) so two concurrent runs can't both squeak under the limit.

**Indexes from day one.**
- `generations (run_id)`, `generations (user_id, created_at desc)`, `generations (status)` for the polling query and history page.
- `runs (user_id, created_at desc)`.
- `usage_monthly (user_id, year_month)` is the primary key.
- `profiles (stripe_customer_id)` unique for webhook lookups.

**Row-level security on every user table.** RLS policies are the gate, not application checks. Any future table that holds user data inherits the same `user_id = auth.uid()` policy template.

**Bounded fan-out.** `POST /api/runs` rejects requests where `N * M > MAX_RUN_IMAGES` (env-configurable, default e.g. 60). Prevents one user from queuing 10,000 generations.

**Per-user rate limit on `POST /api/runs`.** Token-bucket via Postgres (`rate_limits (user_id, bucket, tokens, refilled_at)`) — N runs per minute, env-configurable. Sceneify itself has no rate limiting yet (per its CLAUDE.md), so Darkroom is the choke point that protects fal.ai spend.

**Image hosting that scales.** Watermarked images go to Vercel Blob (CDN-fronted) in production. Local dev falls back to `./public/watermarked/` for convenience but the code path is identical.

**Observability hooks ready to fill in.**
- Every Sceneify call wraps a structured log (request id, user id, run id, generation id, latency, cost estimate).
- Every workflow step logs start/end/error with the run id.
- Stripe webhook logs event type + id.
- PostHog can be wired in later by importing the events from these log calls — instrumentation locations are decided up front.

**Database driver choice.** Use Supabase's connection-pooled URL (`pgbouncer` mode) for serverless workloads; direct connection only for migrations.

## Out of scope this iteration

- PostHog analytics (deferred per CLAUDE.md but not now)
- Production Vercel deploy
- Custom domain
- Email transactional flows beyond Supabase magic-link defaults
- Adding new presets to Sceneify (ship with whatever Sceneify exposes)
- Admin UI / user impersonation
- Refunds / dunning beyond Stripe defaults

## Open follow-ups (post-MVP)

1. Add PostHog instrumentation alongside generation events (hook locations already decided — see Scalability/Observability).
2. Wire Vercel Blob into Sceneify so both services share storage and Darkroom doesn't need to re-host watermarked images.
3. Add presets to Sceneify (drop image folders, register IDs).
4. Move Sceneify's metadata off its JSON file db onto Postgres before production (called out in Sceneify's own CLAUDE.md).
