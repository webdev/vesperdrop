# Vesperdrop

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
  - Flux image gen → `@fal-ai/client` direct (queue-based streaming doesn't fit Gateway shape)
- **Testing**: Vitest (unit), Playwright (e2e)

## Architectural constraints

- All LLM calls go through `lib/ai.ts`. Never import `openai` or `@fal-ai/client` from routes/components/hooks.
- Every generation persists to Supabase **before** returning to the client. No orphan images.
- Every external API call (OpenAI, Fal, Stripe) wraps retry + structured logging + cost tracking.
- Every user-facing route has an `error.tsx` boundary.
- PostHog events instrumented alongside feature code, not backfilled.
- Env-driven everything. No hardcoded keys, even for test/dev.

## Pricing model (credit-based, as of 2026-04-27)

1 credit = 1 generated lifestyle image at full 2000px resolution.

### Free tier (acquisition engine)
- 1 full-resolution HD generation (no watermark, no card)
- 5 watermarked 720p previews
- Goal: convert within first session. Cost to us: ~$0.04 per free user who generates.

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

### Model costs (April 2026)
| Model                          | Cost/image | Use case                          |
|--------------------------------|------------|-----------------------------------|
| Flux Schnell (fal.ai)          | ~$0.003    | Free watermarked previews         |
| Flux 1.1 Pro (fal.ai)          | ~$0.04     | Paid HD generations               |
| Nano Banana 2 (Gemini Flash)   | ~$0.039    | Paid HD, photoreal product shots  |
| GPT-Image-1 medium (OpenAI)    | ~$0.16     | Premium quality                   |
| GPT-Image-1 high (OpenAI)      | ~$0.25     | Print-quality / high-spend        |
| VLM auto-describe (LLaVA)      | ~$0.002    | Per-generation overhead           |

Blended paid COGS: ~$0.06–0.10/image. Free preview (Flux Schnell): ~$0.005.

### Reference picking strategy (how presets work)
- **MVP (now)**: At generation time, randomly grab 3–5 reference images from the preset and feed as style/IP-adapter inputs alongside the user's flatlay. Zero new infra. Results vary slightly run-to-run.
- **v2 (month 1)**: VLM-matched references. VLM (LLaVA / Gemini Flash) classifies the user's garment first (denim shorts, knit top, leather jacket), then pulls the 3–5 preset references that best match. ~10× more consistent quality.
- **v3 (month 3)**: LoRA fine-tune per preset. One-time ~$30–100 training per preset (Replicate or fal.ai). Generations in that preset use the LoRA at zero extra inference cost. This is what Lalaland.ai and Botika do. Required for premium brand-tier output.
- **Recommended path**: Ship MVP this week → v2 in parallel → v3 after 100 paying customers.

## Freemium-to-paid conversion mechanic

This is the single most important UX decision. The pattern:
1. User uploads flatlay → free generation runs on **Flux Schnell** (~8s, $0.005)
2. Result appears watermarked + 720p
3. Below result: "Upgrade to HD, no watermark — $9 for 10 credits, or $49/mo for 200."
4. HD version generates on **Flux 1.1 Pro / Nano Banana 2** the moment they pay — they see the upgrade in real time.

Converts at 8–15% in fashion-tool benchmarks. Higher than any pure paywall.

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
- ⏳ Domain: vesperdrop.com (user to purchase)

## Reference material

Existing design JSX in `design-reference/` is **directional, not pixel-sacred**. Port shapes and flows, refactor aesthetics freely against shadcn primitives.
