# Pricing v2 — Design

Date: 2026-05-10
Status: Approved (pending spec re-read)

## Goal

Move VesperDrop to a photo-based subscription model with four tiers, a monthly/annual billing toggle, metered overage past the cap, and a contact-sales flow for Agency-and-up volume. Rename internal `credits` to `quota_units` so the schema doesn't bake in a product noun, while displaying "photos" everywhere user-facing.

All gross-margin math assumes a $0.17/photo hard cost; every tier holds at least 50% margin at full usage.

## Locked decisions

- No live paying subscribers exist. Old Stripe products are archived; new products are created fresh in test mode first, then mirrored to live mode.
- Schema column `credits` is renamed to `quota_units` via migration. UI strings say "photos" exclusively.
- Overage billing ships in v1 via Stripe metered subscription items.
- Agency tier uses a contact-sales CTA, not direct checkout.
- Free funnel (`/try`, `/app/claim`) is out of scope; the recent freemium-funnel commits are the source of truth.
- No customer migration script, no comms emails, no proration logic.

## Pricing structure

| Tier | Monthly | Photos/mo | Annual (eff. /mo) | Annual total | Overage |
|---|---|---|---|---|---|
| Free | $0 | 1 HD + 2 watermarked previews | — | — | — |
| Starter | $19 | 25 | $15.20 | $182.40 | $0.50 / photo |
| Pro | $39 | 75 | $31.20 | $374.40 | $0.50 / photo |
| Studio | $99 | 250 | $79.20 | $950.40 | $0.50 / photo |
| Agency | $499 | 1,500 | $399.20 | $4,790.40 | $0.40 / photo |

Annual is 20% off the monthly rate, billed annually as a lump sum. Quota grants are made monthly via cron, not the entire annual quota upfront.

## Catalog file shape

`src/lib/plans.ts` splits into three exports so the four Phase-2 agents can edit without conflict:

```ts
export const PLAN_MARKETING: Record<PlanSlug, {
  label: string;
  description: string;
  features: string[];
  badge?: "popular" | "for-agencies";
  ctaLabel: string;
  ctaTarget: "checkout" | "contact";
  perPhotoDisplay: string;   // "$0.52 per photo"
  overageDisplay: string;    // "overage at $0.50"
}>;                          // Agent A owns

export const PLAN_STRIPE: Record<PaidPlanSlug, {
  monthlyPriceIdEnv: keyof typeof env;
  annualPriceIdEnv: keyof typeof env;
  overagePriceIdEnv: keyof typeof env;
}>;                          // Agent B owns

export const PLAN_QUOTA: Record<PlanSlug, {
  monthlyQuota: number;      // 0 for free; free funnel handles its own caps
  overageCentsPerPhoto: number;
}>;                          // Agent C owns
```

## Pricing page UI (`src/app/(marketing)/pricing/page.tsx`)

1. **Hero (centered, serif)**: "Lifestyle shots for every product." with subhead "Try free, no card needed. Upgrade when you see the result. Photos refresh every billing cycle."
2. **Monthly/Annual toggle** with URL state `?billing=annual`. Default Monthly. Annual label reads "Annual, save 20%". Toggle updates all prices and the comparison table header.
3. **Two hero cards side-by-side** (Free cream-with-border, Pro dark `#2C2C2A`). Pro has a rust-orange "MOST POPULAR" pill, a rust-orange "Start Pro" filled CTA, and a footnote "$0.52 per photo, overage at $0.50".
4. **Comparison table** — 4 rows (Starter / Pro [POPULAR pill] / Studio / Agency [FOR AGENCIES dark pill]). Columns: Tier · Photos / mo · Per-photo · Price · CTA. Header text flips with the toggle.
5. **Custom plans callout** — full-width below table: "Need more than 1,500 photos a month?" body "Custom plans for big brands, agencies, and high volume sellers. API access, team seats, and white label available." CTA "Contact us" → `/contact?source=pricing-custom`.
6. **Notes (two-column)** — overage rules + annual billing rules.
7. **Footer** — "Billing by Stripe. Secure, cancel any time, no hidden fees."

Component reuse per CLAUDE.md §9:
- Restructure `PricingCards` into `<HeroPair>` (Free + Pro) and `<ComparisonTable>`.
- New `<MonthlyAnnualToggle>` (client) and `<BillingProvider>` context.
- Keep `PricingFaq` unchanged.

Copy rules: no em dashes anywhere; sentence case for headlines and descriptions; small all-caps only for the short pills; voice direct and human (no "leverage", "empower", "AI-powered" filler).

## Stripe objects

Created fresh by me via Stripe MCP, with per-product confirmation. Test mode first, then live mode.

| Product | Prices |
|---|---|
| Starter | `starter_monthly` $19/mo, `starter_annual` $182.40/yr, `starter_overage` $0.50/photo metered |
| Pro | `pro_monthly` $39, `pro_annual` $374.40/yr, `pro_overage` $0.50 metered |
| Studio | `studio_monthly` $99, `studio_annual` $950.40/yr, `studio_overage` $0.50 metered |
| Agency | `agency_monthly` $499, `agency_annual` $4,790.40/yr, `agency_overage` $0.40 metered |

Metered prices: `recurring.usage_type: "metered"`, `recurring.aggregate_usage: "sum"`, `billing_scheme: "per_unit"`. Each paid subscription is created with two items — the flat price plus the metered overage price (zero usage until cap exceeded). Old products are archived.

### New env vars

```
STRIPE_STARTER_PRICE_ID_MONTHLY, _ANNUAL, _OVERAGE
STRIPE_PRO_PRICE_ID_MONTHLY, _ANNUAL, _OVERAGE
STRIPE_STUDIO_PRICE_ID_MONTHLY, _ANNUAL, _OVERAGE
STRIPE_AGENCY_PRICE_ID_MONTHLY, _ANNUAL, _OVERAGE
CONTACT_SLACK_WEBHOOK_URL
```

Added on Vercel via `vercel env add`. Per the user's memory: never run `vercel env pull`.

## Checkout, webhook, reconcile

- `createCheckoutSession(plan, interval)` selects the flat price by interval and always attaches the matching overage price as a second item with `quantity: 0`.
- Agency CTA is intercepted client-side and routed to `/contact?source=pricing-agency` rather than checkout.
- `success_url` carries `?plan=&interval=` so the existing `CheckoutSuccessTracker` event includes interval for GTM.
- Webhook adds metered-line handling on `invoice.paid` and handles annual billing intervals. Reconcile sets the local plan + interval + period anchors from the subscription.
- Monthly grants for annual subscribers happen via a new daily cron `/api/cron/grant-monthly-annual-quota` that grants 1/12 of annual allocation when last grant was ≥28 days ago.

## Schema rename + quota engine

Migration `supabase/migrations/20260510000001_rename_credits_to_quota.sql`:
- Rename column(s) `credits_*` → `quota_units_*` on user/subscription tables (final list determined by grep pass — initial candidates: `users.credits_remaining`, `users.credits_reset_at`).
- Rename `credit_ledger` to `quota_ledger` if it exists.
- Rename RPCs: `consume_credit` → `consume_quota`, `grant_credits` → `grant_quota`, `usage_check` updated accordingly.
- Drizzle `src/lib/db/schema.ts` regenerated to match.

New `src/lib/billing/quota.ts`:
```ts
consumeQuota(userId, opts: { allowOverage: boolean }):
  | { ok: true, withinCap: boolean }
  | { ok: false, reason: "free_exhausted" };
```
- Reads `PLAN_QUOTA[userPlan].monthlyQuota`.
- Allows past cap on paid tiers; returns `withinCap: false`, which the generation flow uses to trigger a usage record.
- Free tier hard-caps via existing `try_intents`.
- Quota window is the subscription anniversary (`current_period_start`), not the calendar month.

Failed-generation retry credit:
- Simple variant: store `last_failed_run_at` on the user row. If next call is within 5 minutes of that timestamp, skip `consumeQuota`. Auditability is fine because the `runs` table already logs every attempt.

## Overage hook (in generation success path)

```ts
if (!withinCap) {
  await stripe.subscriptionItems.createUsageRecord(overageItemId, {
    quantity: 1,
    timestamp: nowSec(),
    action: "increment",
  }, { idempotencyKey: `overage:${runId}` });
}
```
- Idempotency key tied to `run_id` so retries cannot double-bill.
- Surfaced in `src/components/app/plan-summary-card.tsx` as an "accrued this cycle" line that reads from the local `quota_ledger` (sum of `kind = "overage"` rows since `current_period_start`).

## Contact form

- `src/app/(marketing)/contact/page.tsx` — server-rendered form.
- `src/app/api/contact/route.ts` — POST handler, Zod-validated, rate-limited via existing `rate_limit_rpc`.
- Fields: name, email, company, monthly volume (select), message, hidden source tag.
- Delivery: POST to `CONTACT_SLACK_WEBHOOK_URL`. No email pipeline in v1.
- Anti-abuse: honeypot field, 3 submissions per IP per hour.
- Success: inline thank-you, no redirect.

## Out of scope

- Free funnel changes (already shipped).
- Customer migration script and announcement emails (no live customers).
- Agency-specific features beyond the form (API access, white-label, team seats — deferred to v2 per the launch brief).
- Transactional email pipeline (Resend/Postmark/SES). Slack webhook only.
- A/B testing on free tier generosity or Pro pricing.
- Cloudflare Turnstile on `/try` (free funnel out of scope; can be added later if abuse appears).

## Build plan

### Phase 1 — sequential prep (me, with per-step user confirmation)
1. Grep all `credits` references; write `supabase/migrations/20260510000001_rename_credits_to_quota.sql` and update Drizzle schema. Commit on `main`.
2. Create new Stripe products + prices via Stripe MCP in **test mode**. Pause after each tier for user confirmation.
3. Add new `STRIPE_*_PRICE_ID_*` env vars to local `.env.local` and Vercel preview/development environments.
4. Repeat steps 2 and 3 against live mode after Phase 3 integration verification.

### Phase 2 — four parallel agents in isolated worktrees
- **Agent A — Pricing page + marketing catalog**: rewrites `PLAN_MARKETING` in `plans.ts`, rebuilds `src/app/(marketing)/pricing/page.tsx`, adds `MonthlyAnnualToggle` + `BillingProvider`, restructures `PricingCards`. Forbidden: any DB, Stripe, or generation-flow file.
- **Agent B — Stripe money flow**: writes `PLAN_STRIPE` in `plans.ts`, updates `src/lib/stripe/server.ts` for annual + metered, updates `webhook.ts` and `reconcile.ts`, adds `/api/cron/grant-monthly-annual-quota`, ships tests. Forbidden: UI, schema, generation flow.
- **Agent C — Schema + quota + overage hook**: lands the migration and `src/lib/billing/quota.ts`, replaces all `credits` callsites, writes the overage usage-record call inside the generation success path, surfaces accrual in `plan-summary-card.tsx`. Forbidden: UI marketing files, Stripe price creation, contact form.
- **Agent D — Contact form**: builds `/contact` page + `/api/contact` route + Slack webhook delivery. Forbidden: everything else.

### Phase 3 — integration (me)
1. Rebase agents in order: A → C → D → B (B last because it consumes price IDs from steps generated by all three).
2. Local end-to-end: free flow → signup → Pro checkout (monthly) → trigger 76th-photo generation → verify usage record appears on Stripe test invoice → toggle to annual on a fresh session → verify cron grants quota.
3. Mirror Stripe products to live mode, swap env vars, redeploy.

## Risks

- Schema rename touches many migrations and the Drizzle schema. The grep pass in step 1 must enumerate every reference; missing one will cause runtime errors. Mitigation: typescript `tsc --noEmit` catches references in `.ts`/`.tsx`; manual sweep of `.sql` files in `supabase/migrations` and `drizzle/sql`.
- Metered overage requires Stripe to receive usage records before the period ends. If the cron or hook fails, overage isn't billed. Mitigation: idempotent usage records keyed on `run_id` allow safe re-submission from a reconciliation job; add an end-of-period reconcile that compares local `quota_ledger` overage rows to Stripe usage records.
- Annual quota distribution depends on the cron firing daily. Mitigation: cron route checks for any annual sub with `last_grant_at < now() - interval '28 days'` so a missed day catches up the next day.
- `MonthlyAnnualToggle` URL state needs to round-trip cleanly through the checkout `success_url`, otherwise GTM events will miscount annual conversions. Mitigation: explicit test in Agent A and Agent B.

## Open items (none blocking spec freeze)

- Exact Slack channel for `CONTACT_SLACK_WEBHOOK_URL`: user to provide before Phase 2 D lands.
- Whether to add Turnstile to `/contact` later — revisit only if spam appears.
