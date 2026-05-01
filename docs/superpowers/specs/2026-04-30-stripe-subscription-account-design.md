# Stripe subscription + account billing page

**Date:** 2026-04-30
**Status:** Approved, ready for plan
**Scope:** Wire all 4 monthly subscription tiers through checkout, render a real billing surface on `/account`, deep-link plan switches into the Stripe Customer Portal. Yearly billing and one-time credit packs are explicitly deferred.

## Context

The 4 subscription products (Starter / Pro / Studio / Agency) already exist in Stripe (test mode "Darkroom sandbox") with one monthly price each. The webhook handler already maps every tier's price ID to a plan name and the credit-grant table already covers all 4 tiers. The gaps are on the storefront and config side:

- `src/app/api/stripe/checkout/route.ts` ignores the `?plan=` query param that `pricing-cards.tsx` already passes — every subscription created becomes Pro.
- Only `STRIPE_PRO_PRICE_ID` is set in `.env.local`; the other 3 price IDs are unknown to the app.
- `src/app/(app)/account/page.tsx` shows a single "Upgrade to Pro" button. Subscribers can only reach the Stripe portal home; there's no in-app way to see what other tiers offer or to switch.
- The 4 products in Stripe are still named "Darkroom *" (the prior project name), so receipts and the customer portal display the wrong brand.

### Stripe price IDs (test mode, captured 2026-04-30)

| Plan | Stripe product | Price ID | Monthly | Credits |
|---|---|---|---|---|
| Starter | `prod_UPrehbf1nvP9f9` | `price_1TR1vSRuFrEhCusXcjF64hLx` | $19 | 50 |
| Pro | `prod_UPreSHjEMCub2d` | `price_1TR1vTRuFrEhCusXHB9gDFUO` | $49 | 200 |
| Studio | `prod_UPrek8AVOYx9kn` | `price_1TR1vTRuFrEhCusX9bphVKhH` | $149 | 1,000 |
| Agency | `prod_UPrekhntN0P9fp` | `price_1TR1vURuFrEhCusXvIMtZ3C4` | $499 | 5,000 |

## Design

### 1. Shared plan catalog

Create `src/lib/plans.ts` as the single source of truth for plan metadata. `pricing-cards.tsx` and the new account page both consume it. The TIERS array currently inline in `pricing-cards.tsx` is removed and the file becomes layout-only over this catalog.

```ts
// src/lib/plans.ts
export type PlanSlug = "free" | "starter" | "pro" | "studio" | "agency";

export interface PlanRecord {
  slug: PlanSlug;
  label: string;
  price: number;        // monthly USD
  credits: number;      // monthly allotment
  perCredit: string;    // marketing string, e.g. "25¢"
  priceIdEnv: string | null;  // null for free
  recommended?: boolean;
  features: string[];
}

export const PLAN_CATALOG: Record<PlanSlug, PlanRecord> = {
  free:    { slug: "free",    label: "Free",    price: 0,   credits: 0,    perCredit: "—",   priceIdEnv: null,                          features: [/* lifted from current pricing-cards Free card */] },
  starter: { slug: "starter", label: "Starter", price: 19,  credits: 50,   perCredit: "38¢", priceIdEnv: "STRIPE_STARTER_PRICE_ID",      features: [/* lifted from current pricing-cards TIERS.starter */] },
  pro:     { slug: "pro",     label: "Pro",     price: 49,  credits: 200,  perCredit: "25¢", priceIdEnv: "STRIPE_PRO_PRICE_ID",          features: [/* lifted from TIERS.pro */], recommended: true },
  studio:  { slug: "studio",  label: "Studio",  price: 149, credits: 1000, perCredit: "15¢", priceIdEnv: "STRIPE_STUDIO_PRICE_ID",       features: [/* lifted from TIERS.studio */] },
  agency:  { slug: "agency",  label: "Agency",  price: 499, credits: 5000, perCredit: "10¢", priceIdEnv: "STRIPE_AGENCY_PRICE_ID",       features: [/* lifted from TIERS.agency */] },
};

export const PAID_PLAN_SLUGS = ["starter", "pro", "studio", "agency"] as const;
```

The `features` arrays are copied verbatim from the current TIERS array in `pricing-cards.tsx` (and the Free card body) — no new copy. Numbers come from the table in the Context section.

A small helper `priceIdForPlan(slug)` resolves the env-backed price ID via the typed `env` accessor and throws on unknown slug. Used by both routes and tests.

### 2. Backend changes

#### `src/app/api/stripe/checkout/route.ts`

- Read `?plan=<slug>` from the query string. Validate against `PAID_PLAN_SLUGS`.
- Unknown or missing slug → redirect to `/pricing` (303). No error toast — the user landed somewhere they shouldn't have.
- Resolve the price ID via `priceIdForPlan(slug)` (extracted as a pure function so it's unit-testable).
- Pass through to `stripe.checkout.sessions.create` as today; success/cancel URLs unchanged.

#### `src/app/api/stripe/portal/route.ts`

Accept two optional query params:

- `?to=<slug>` — target plan slug for an in-portal switch. When set:
  1. Fetch the customer's active subscription via `stripe.subscriptions.list({ customer, status: "active", limit: 1 })`.
  2. If none exists, redirect (303) to `/api/stripe/checkout?plan=<slug>` (smooth path for users whose sub was cancelled and who clicked "Switch to Studio").
  3. Otherwise, create a portal session with `flow_data.type = "subscription_update_confirm"`, pre-filled with the subscription ID, the existing item ID, and the target price ID, then redirect to its URL.
- No params → portal session with no `flow_data`, redirect to its URL (lands on portal home for invoices, payment method, cancel).

Cancel is handled by the portal home ("Manage billing →"). No dedicated cancel route in this PR.

Unknown `to` slugs → 400 (this comes from our own UI; bad data should fail loudly).

#### `src/lib/env.ts`

Promote `STRIPE_STARTER_PRICE_ID`, `STRIPE_STUDIO_PRICE_ID`, `STRIPE_AGENCY_PRICE_ID` from `.optional()` to `z.string().min(1)`. The webhook already references them; this enforces the precondition that they're configured.

`.env.local` and `.env.local.example` get the three new keys. The example file uses placeholder strings; `.env.local` gets the real test-mode price IDs from the table above.

### 3. Account page layout

File: `src/app/(app)/account/page.tsx`. The Security section stays unchanged. The Plan section is replaced with three blocks:

#### a. Plan summary card

Full-width card at the top of the Plan section. Renders:

- Plan label (e.g. "Pro") in serif, large.
- Sub-line: `{credits_balance} credits remaining` and, if active, `· Renews {plan_renews_at, locale-formatted}`.
- Status pill if `cancel_at_period_end` is true (read from Stripe at render time, see below): "Canceling on {date}".
- Right-aligned `Manage billing →` link to `/api/stripe/portal` (no params).

The page server component fetches subscription state from Stripe at render time when `profile.stripe_customer_id` is present, to read `cancel_at_period_end` and the canonical `current_period_end` (the `profile.plan_renews_at` column lags by a webhook). One Stripe call per page load is acceptable; cache via `unstable_cache` keyed on customer ID with a 60s TTL is a reasonable follow-up but out of scope for this spec.

#### b. Plan grid

Four cards in a responsive grid (1 / 2 / 4 columns), one per paid tier, generated from `PLAN_CATALOG`. Each card shows:

- Label, monthly price, monthly credit allotment, per-credit cost.
- 3–4 feature bullets (reused from the catalog).
- A single CTA whose state depends on `(profile.plan, target.slug)`:

| Profile state | Card state | CTA |
|---|---|---|
| `plan = "free"` | any tier | `Choose {tier}` → `/api/stripe/checkout?plan={slug}` |
| `plan = target.slug` | this tier | `Current plan` (disabled, pill style) |
| `plan = "<other paid>"`, target ≠ current | other tier | `Switch to {tier}` → `/api/stripe/portal?to={slug}` |

The Pro card shows the existing "Most popular" badge.

#### c. Credit packs placeholder

A single muted line below the grid: `Need more this month? Top-up packs coming soon.` No link, no card. This keeps the page honest until packs ship.

#### d. Sign out

The existing sign-out form stays at the bottom of the page (outside the Plan section).

The current `src/components/app/upgrade-button.tsx` becomes unused. Delete it.

### 4. Stripe-side prerequisites

Done once as part of this PR, in test mode only. Both reversible.

- **Rename the 4 products** via the Stripe CLI:
  ```
  stripe products update prod_UPrehbf1nvP9f9 --name "Vesperdrop Starter"
  stripe products update prod_UPreSHjEMCub2d --name "Vesperdrop Pro"
  stripe products update prod_UPrek8AVOYx9kn --name "Vesperdrop Studio"
  stripe products update prod_UPrekhntN0P9fp --name "Vesperdrop Agency"
  ```
- **Configure the Customer Portal** to allow subscription updates across all 4 prices with prorated billing. Either via the Stripe Dashboard (test mode) or via `stripe billing_portal configurations create` with `features.subscription_update.enabled = true`, `default_allowed_updates = ["price"]`, `proration_behavior = "create_prorations"`, and `products = [{product, prices}]` listing all 4 products. The resulting configuration ID is recorded in the PR description so prod can mirror it.

These two steps are operational, not code, but the implementation plan should treat them as required tasks gated before merge.

### 5. Error handling

- Checkout route, unknown `?plan` → 303 redirect to `/pricing`.
- Checkout route, unauthenticated → existing 303 to `/sign-in?next=/pricing`.
- Portal route, unknown `?to` slug → 400 (bad request from our own UI; should never happen).
- Portal route, no Stripe customer on profile → existing redirect to `/account`.
- Portal route, `?to` set but no active subscription → fall through to `/api/stripe/checkout?plan=<slug>`.
- Account page Stripe API call failure → render the page using only DB state; log the failure. The page must not 500 if Stripe is degraded — billing visibility is non-essential to the rest of `/account`.
- Account page relies on the existing `src/app/(app)/account/error.tsx`. No new boundary.

### 6. Testing

- **Unit:** new test file `src/lib/plans.test.ts` covering `priceIdForPlan` happy path + unknown-slug throw + unset-env throw.
- **Unit:** extend `src/lib/stripe/webhook.test.ts` with one case per tier mapping (Starter, Studio, Agency in addition to existing Pro).
- **Unit:** extract the slug → price-ID resolution from the checkout route into the same `lib/plans.ts` helper and test there. Route handler stays a thin wrapper.
- **No new e2e:** the existing smoke spec covers the flow shape; Stripe portal redirects aren't exercisable in test mode without cassettes. Defer.

### 7. Rollout

- Apply the env updates first (`.env.local`), restart dev, confirm the `env.ts` schema parses.
- Rename Stripe products and configure portal before deploying so the customer-facing strings are right on first hit.
- Manual QA pass (free → Starter via checkout, free → Pro via checkout, Pro → Studio via portal flow_data, Pro → Starter via portal flow_data, Pro → cancel via portal home).

## Out of scope (deferred follow-ups)

- **Yearly billing** — requires 4 new Stripe prices, env vars, catalog metadata, and a checkout-time interval picker. The `/pricing` toggle keeps showing yearly UI but it stays cosmetic until the follow-up.
- **One-time credit packs** — requires 3 new products/prices, a new `?plan=pack-N` branch in the checkout route (one-time mode, not subscription), and a new webhook event handler that grants packed credits without changing the plan. The pack cards on `/pricing` are left in place but I'll add a TODO note in `pricing-cards.tsx` flagging the dead links until the follow-up lands.
- **Live-mode setup** — this work is test-mode only. A separate setup task will mirror the products, prices, and portal configuration into the live account before launch.

## Files touched

| File | Change |
|---|---|
| `src/lib/plans.ts` | **new** — catalog + helpers |
| `src/lib/plans.test.ts` | **new** — helper tests |
| `src/lib/env.ts` | promote 3 price IDs from optional to required |
| `src/app/api/stripe/checkout/route.ts` | honor `?plan=` |
| `src/app/api/stripe/portal/route.ts` | honor `?to=` and `?action=cancel` |
| `src/app/(app)/account/page.tsx` | replace Plan section with summary + grid |
| `src/components/marketing/pricing-cards.tsx` | read from catalog, drop inline TIERS |
| `src/components/app/upgrade-button.tsx` | **delete** |
| `src/lib/stripe/webhook.test.ts` | add per-tier cases |
| `.env.local` | add 3 price IDs |
| `.env.local.example` | add 3 placeholder keys |
