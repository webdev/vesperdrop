# Darkroom

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

## Pricing (MVP defaults, subject to test)

- Free: 2 watermarked preview images per batch (diagonal stripe watermark)
- $5/batch: full 6-image batch, full resolution, no watermark
- $20/month: unlimited batches

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
- ⏳ Domain: darkroom.ai (user to purchase)

## Reference material

Existing design JSX in `design-reference/` is **directional, not pixel-sacred**. Port shapes and flows, refactor aesthetics freely against shadcn primitives.
