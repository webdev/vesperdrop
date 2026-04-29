# Verceldrop

AI lifestyle photography tool for Shopify/Amazon sellers. Turns rough product photos into conversion-optimized 6-image batches using conversion-seeded presets.

## Stack (locked)

- **Framework**: Next.js 16 App Router, TypeScript strict, Tailwind, shadcn/ui
- **Package manager**: pnpm
- **Hosting**: Vercel (Fluid Compute)
- **Data**: Supabase (Postgres + Auth)
- **Image storage**: Vercel Blob
- **Payments**: Stripe Checkout (hosted)
- **Analytics**: PostHog cloud
- **AI**:
  - GPT-4o vision → Vercel AI Gateway via AI SDK v6 (`openai/gpt-4o`)
  - Image generation → **Sceneify** (internal API at `SCENEIFY_API_URL`), called via `lib/ai/sceneify.ts` with Vercel OIDC. Sceneify wraps the underlying providers (gpt-image-2, nano-banana-2, flux-kontext, flux-2) and exposes a single `presetSlug + model + quality` interface.
- **Testing**: Vitest (unit), Playwright (e2e)

## Architectural constraints

- All LLM/image-gen calls go through `lib/ai/*` wrappers. Never call Sceneify HTTP or import `openai` from routes/components/hooks.
- Every authenticated generation persists to Supabase **before** returning to the client. No orphan images. (`/try` is anonymous and intentionally non-persistent — see UX section.)
- Every external API call (OpenAI, Sceneify, Stripe) wraps retry + structured logging + cost tracking.
- Every user-facing route has an `error.tsx` boundary.
- PostHog events instrumented alongside feature code, not backfilled.
- Env-driven everything. No hardcoded keys, even for test/dev.

## Pricing model (credit-based, as of 2026-04-27)

1 credit = 1 generated lifestyle image at full 2000px resolution.

### Free tier (acquisition engine)
- Anonymous `/try` flow: up to 5 watermarked previews per visitor, generated through Sceneify (`gpt-image-2`, medium quality). No account, no card, no DB persistence — results live in client state only.
- Post sign-up: 1 full-resolution HD generation as a sign-up gift (no watermark).
- Goal: convert within first session.

### Subscription tiers
| Tier    | Price    | Credits/mo | ¢/credit | COGS  | Gross margin |
|---------|----------|------------|----------|-------|--------------|
| Starter | $19/mo   | 50         | 38¢      | $4    | ~79%         |
| Pro     | $49/mo   | 200        | 25¢      | $16   | ~67%         |
| Studio  | $149/mo  | 1,000      | 15¢      | $80   | ~46%         |
| Agency  | $499/mo  | 5,000      | 10¢      | $400  | ~20%         |

Yearly pricing: ~20% discount (2 months free). **Pro is the primary conversion target** — 200 credits covers 30–100 SKUs/quarter comfortably. Push 60% of customers here.

### One-time credit packs (non-subscribers / top-ups)
- 10 credits: $9 (90¢/credit)
- 25 credits: $19 (76¢/credit)
- 100 credits: $59 (59¢/credit)
Packs intentionally cost more per credit than subscriptions — they are the upsell mechanism into recurring.

### Scale math
- $33/mo gross profit per Pro customer
- 1,000 customers → $396k GP/yr
- 5,000 customers → ~$2M GP/yr
- 17,000 customers → ~$10M GP/yr (stated goal)

## Generation model strategy

All image generation routes through **Sceneify**, our internal image-gen service. The app never picks providers directly — it picks a `presetSlug + model + quality` and Sceneify handles preset reference assembly, prompt construction, provider dispatch, and color QA.

### Where each model is used today
| Surface                               | Model            | Quality  | Notes                                    |
|---------------------------------------|------------------|----------|------------------------------------------|
| Anonymous `/try` (watermarked)        | `gpt-image-2`    | `medium` | `app/api/try/generate/route.ts`          |
| Authenticated `/api/runs` (paid HD)   | `nano-banana-2`  | `high`   | `lib/workflows/process-run.ts:68`        |

Available models in the wrapper: `gpt-image-2 | nano-banana-2 | flux-kontext | flux-2`. To change a tier's default, edit the call site — do not branch by `model` inside `lib/ai/sceneify.ts`.

Reference picking, preset weighting, LoRA fine-tunes, and per-preset tuning are Sceneify-side concerns. This repo treats Sceneify as a black box behind a stable HTTP contract.

## Freemium-to-paid conversion mechanic

This is the single most important UX decision. The pattern:
1. User uploads flatlay on `/try` → up to 5 watermarked previews generate via Sceneify (`gpt-image-2`, medium). One request per picked scene, parallel, anonymous.
2. As tiles complete, the develop grid fills in real time (real images, not stock).
3. Once all picked scenes finish, the sign-up gate appears.
4. After sign-up the user uses their 1-credit HD gift via the authenticated `/api/runs` path, which runs Sceneify at `nano-banana-2` quality `high`.

Anonymous `/try` is throttled with an in-memory per-IP rate limiter in the route. Replace with a durable rate limiter when traffic warrants.

## Commands

```bash
pnpm dev              # Next dev on :3000
pnpm build            # Production build
pnpm test             # Vitest unit tests
pnpm test:e2e         # Playwright
pnpm lint             # ESLint + TypeScript
pnpm db:migrate       # Supabase migrations (local)
pnpm db:push          # Push to linked Supabase project
vercel dev            # Run with Vercel runtime (use when testing Blob / env / edge behavior)
vercel env pull       # Sync env from Vercel to .env.local
vercel deploy         # Preview deploy
vercel deploy --prod  # Production
```

## Conventions

- Route handlers in `app/**/route.ts` for APIs; Server Actions allowed for mutations tied to forms.
- Components in `components/ui/` are shadcn primitives; `components/app/` are feature components.
- Server-only modules get `import "server-only"` at the top.
- Zod schemas in `lib/schema/` — share between client and server validation.
- All DB access via `lib/db/` helpers, never raw `createClient()` calls scattered around.
- Secrets referenced via typed env accessor in `lib/env.ts` (T3-style), not `process.env.*` direct.

## UX decisions & rationale

These decisions were made after a full flow audit (2026-04-27). Don't revert without reason.

### Nav
- **One primary CTA only**: "Try it →" (`/try`) is the single nav CTA. "Open account →" was removed — it caused decision paralysis. Account creation happens inside the `/try` flow after the user's first batch.
- "Sign in" stays as a ghost link for returning users.

### Homepage section order
The order is intentional: **Hero → How it works → Gallery → Testimonials → CTA → Closing**.
- "How it works" was moved before the gallery so users understand the mechanism before seeing examples.
- Testimonials were extracted from inline gallery captions into a dedicated `<Testimonials />` section (FIELD NOTES · N°04) for visibility.
- The mid-page CtaBand ("See it on your product") was removed — it interrupted the narrative before the gallery. The single post-gallery CTA is sufficient.

### Hero stats bar
Four columns: 3 FREE SHOTS · A+ READY · ~90 SECONDS · PRO FROM $20. The pricing anchor was added so users don't hit the final CTA with zero price context.

### Pricing page button hierarchy
- Free plan: ghost/outline button (border only, no fill).
- Pro plan: solid dark button — most visually dominant, because that's the plan we want users to choose.
- Previously inverted (Free was solid black, Pro was ember outline).

### Auth layout (`/sign-up`, `/sign-in`)
Split layout: left panel carries brand wordmark, 4 benefit bullets, and 3 testimonial quotes. Right panel has the form. Left panel is hidden on mobile. Purpose: prevent users from losing context right before they commit.

### /try upload step
- Example image label changed from "REF · BEFORE" (ambiguous) to "YOURS CAN LOOK LIKE THIS".
- Section header changed from "Example input" to "Example of a good input →".
- One-line tip added below the rotating image: "Hanger, mannequin, flat on the floor — any angle works."

### Open items (not yet implemented)
- FAQ section (4 Qs) before the closing CTA on the homepage.
- Non-apparel examples in the gallery to match hero copy ("kitchens, counters, coffee tables").
- Label/tooltip on the bottom-left "N" avatar (currently unlabelled on all pages).

## Do NOT

- Don't push to GitHub or deploy without explicit user approval.
- Don't amend commits or force-push.
- Don't commit anything under `design-reference/` — it stays gitignored until archived separately.
- Don't add docs/README files unless asked.
- Don't write trailing summary paragraphs in responses.

## External accounts status (as of 2026-04-22)

- ✅ OpenAI API key (user has)
- ✅ Fal.ai API key (user has)
- ✅ GitHub (user has)
- ⏳ Vercel — user to create + CLI login
- ⏳ Supabase — provision via Vercel Marketplace
- ⏳ Stripe — provision via Vercel Marketplace, test mode
- ⏳ PostHog — cloud signup
- ⏳ Domain: verceldrop.com (user to purchase)

## Reference material

Existing design JSX in `design-reference/` is **directional, not pixel-sacred**. Port shapes and flows, refactor aesthetics freely against shadcn primitives.
