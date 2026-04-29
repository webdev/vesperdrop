# Verceldrop

AI lifestyle photography for Shopify and Amazon sellers. Upload a flatlay or rough product shot; get a 6-image batch of conversion-ready lifestyle photos in about 90 seconds.

The product is built around one mechanic: a free, watermarked preview that converts in the same session by upgrading the same image to full HD without a watermark the moment the user pays.

## What it does

1. User drops a product photo on `/try` (no account required).
2. We pick a preset (kitchen counter, hanger, mannequin, on-body, flat-lay, etc.).
3. Sceneify — our internal image-gen service — assembles preset references, builds the prompt, dispatches to the right provider, and runs color QA.
4. The user sees up to 5 watermarked 720p previews in their browser. Nothing is persisted yet.
5. They sign up; the first HD generation is on the house. After that, generations come out of their credit balance (subscription or pack).

## Stack

- **Next.js 16** App Router, TypeScript strict, Tailwind, shadcn/ui
- **pnpm** for package management
- **Vercel** (Fluid Compute) for hosting, **Vercel Blob** for image storage
- **Supabase** Postgres + Auth, accessed through **Drizzle ORM** (`postgres-js` driver)
- **Stripe Checkout** (hosted) for subscriptions and credit packs
- **PostHog** cloud for product analytics
- **AI**:
  - GPT-4o vision through **Vercel AI Gateway** (AI SDK v6)
  - Image generation through **Sceneify**, our internal HTTP service that wraps `gpt-image-2`, `nano-banana-2`, `flux-kontext`, and `flux-2`
- **Vitest** for unit tests, **Playwright** for e2e

## Architecture rules

These are load-bearing — break them and things drift fast.

- All LLM and image-gen calls go through `src/lib/ai/*`. Routes, components, and hooks never import provider SDKs directly.
- Sceneify is treated as a black box behind a stable HTTP contract. Reference picking, preset weighting, and LoRA tuning live on the Sceneify side, not here.
- Authenticated generations persist to Supabase **before** the response returns to the client. No orphan images. The anonymous `/try` flow is intentionally non-persistent — results live in client state only.
- Every external call (OpenAI, Sceneify, Stripe) is wrapped with retry, structured logging, and cost tracking.
- Every user-facing route has an `error.tsx` boundary.
- PostHog events are instrumented next to the feature code, not backfilled.
- All env access goes through the typed accessors in `src/lib/env.ts` / `src/lib/env.client.ts`. No `process.env.*` scattered around.
- All DB access goes through helpers in `src/lib/db/`. No raw `createClient()` calls in route handlers.
- Server-only modules import `"server-only"` at the top.

## Pricing

1 credit = 1 generated lifestyle image at full 2000px resolution.

| Tier    | Price    | Credits/mo | ¢/credit | Margin |
|---------|----------|------------|----------|--------|
| Free    | $0       | 5 previews + 1 HD on signup | — | acquisition |
| Starter | $19/mo   | 50         | 38¢      | ~79%   |
| Pro     | $49/mo   | 200        | 25¢      | ~67%   |
| Studio  | $149/mo  | 1,000      | 15¢      | ~46%   |
| Agency  | $499/mo  | 5,000      | 10¢      | ~20%   |

Yearly plans get ~20% off (two months free). One-time credit packs ($9 / $19 / $59) cost more per credit by design — they exist as the upsell into recurring.

Pro is the conversion target: 200 credits comfortably covers 30–100 SKUs per quarter.

## Repository layout

```
src/
  app/
    (marketing)/     # public homepage, pricing, etc.
    (app)/           # authenticated dashboard, account
    (auth)/          # sign-in, sign-up
    try/             # anonymous freemium flow
    api/             # route handlers
  components/
    ui/              # shadcn primitives
    app/             # feature components
    marketing/       # landing-page sections
  lib/
    ai/              # AI SDK + Sceneify wrappers
    db/              # Drizzle helpers (runs, generations, scenes, rate-limit)
    schema/          # shared zod schemas
    sceneify/        # Sceneify HTTP client + types
    stripe/          # Checkout, webhook, billing
    workflows/       # process-run and other long-lived jobs
drizzle/             # generated migrations
e2e/                 # Playwright tests
```

## Local development

```bash
pnpm install
vercel env pull              # sync env from Vercel into .env.local
pnpm dev                     # Next dev on :3000
```

Common commands:

```bash
pnpm build                   # Production build
pnpm test                    # Vitest unit tests
pnpm test:e2e                # Playwright
pnpm lint                    # ESLint + TypeScript
pnpm db:migrate              # Apply Supabase migrations locally
pnpm db:push                 # Push schema to the linked Supabase project
vercel dev                   # Run with the Vercel runtime (use when testing Blob / edge)
vercel deploy                # Preview deploy
vercel deploy --prod         # Production deploy
```

## Deployment

Production deploys go to Vercel. PRs get preview deployments automatically. Don't push to `main` or run `vercel deploy --prod` without a green CI run and explicit sign-off.

## Conventions

- Route handlers in `app/**/route.ts`. Server Actions are fine for form-bound mutations.
- Components in `components/ui/` are shadcn primitives; `components/app/` are feature-specific.
- Zod schemas live in `lib/schema/` and are shared between client and server.
- Don't commit anything under `design-reference/` — it is intentionally gitignored.

More detail (UX rationale, model strategy, conversion math) lives in `CLAUDE.md`.
