# Stripe Subscription + Account Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all 4 monthly Stripe tiers through `/api/stripe/checkout`, render a real billing surface on `/account` with an in-app plan grid, and deep-link plan switches into the Stripe Customer Portal via `flow_data`.

**Architecture:** Single source of truth for plan metadata in `src/lib/plans.ts`. The checkout route maps `?plan=<slug>` → env-backed price ID. The portal route accepts `?to=<slug>` and pre-fills a `subscription_update_confirm` flow. The account page renders a summary card (live from Stripe) plus a 4-card grid whose CTAs branch on `(profile.plan, target.slug)`.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Stripe Node SDK (`apiVersion: "2026-04-22.dahlia"`), Supabase (Postgres + Auth), Vitest, Tailwind, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-04-30-stripe-subscription-account-design.md`

---

## File map

**New files:**
- `src/lib/plans.ts` — plan catalog, helpers, exported types
- `src/lib/plans.test.ts` — unit tests for `priceIdForPlan` and catalog shape
- `src/components/app/plan-grid.tsx` — client component, 4-card grid with CTA branching
- `src/components/app/plan-summary-card.tsx` — server component, current plan + renewal + manage-billing link

**Modified files:**
- `src/lib/env.ts` — promote 3 price-ID keys from `.optional()` to required
- `src/app/api/stripe/checkout/route.ts` — honor `?plan=`
- `src/app/api/stripe/portal/route.ts` — honor `?to=`, look up active sub, build flow_data
- `src/app/(app)/account/page.tsx` — replace Plan section with summary + grid + packs placeholder
- `src/components/marketing/pricing-cards.tsx` — read paid tiers from `PLAN_CATALOG`, drop inline TIERS
- `src/lib/stripe/webhook.test.ts` — add per-tier mapping cases for Starter/Studio/Agency
- `.env.local` — add 3 real test-mode price IDs
- `.env.local.example` — add 3 placeholder keys

**Deleted files:**
- `src/components/app/upgrade-button.tsx`

---

## Task 0: Stripe-side prerequisites (operational, not code)

These are required before code changes can be tested end-to-end. Test mode only, fully reversible. Run them first so the dev environment is consistent with what the code will assume.

**Files:** none (Stripe Dashboard / CLI)

- [ ] **Step 1: Rename the 4 products to "Vesperdrop *"**

```bash
stripe products update prod_UPrehbf1nvP9f9 --name "Vesperdrop Starter"
stripe products update prod_UPreSHjEMCub2d --name "Vesperdrop Pro"
stripe products update prod_UPrek8AVOYx9kn --name "Vesperdrop Studio"
stripe products update prod_UPrekhntN0P9fp --name "Vesperdrop Agency"
```

Expected: each command prints the updated product JSON with `"name": "Vesperdrop ..."`.

- [ ] **Step 2: Verify the rename**

```bash
stripe products list --limit 10 | python3 -c "import json,sys; [print(p['id'], p['name']) for p in json.load(sys.stdin)['data']]"
```

Expected: 4 lines, all starting with `Vesperdrop`.

- [ ] **Step 3: Configure the Stripe Customer Portal for plan switching**

```bash
stripe billing_portal configurations create \
  --features.subscription_update.enabled=true \
  --features.subscription_update.default_allowed_updates="price" \
  --features.subscription_update.proration_behavior=create_prorations \
  --features.subscription_update.products="[{\"product\":\"prod_UPrehbf1nvP9f9\",\"prices\":[\"price_1TR1vSRuFrEhCusXcjF64hLx\"]},{\"product\":\"prod_UPreSHjEMCub2d\",\"prices\":[\"price_1TR1vTRuFrEhCusXHB9gDFUO\"]},{\"product\":\"prod_UPrek8AVOYx9kn\",\"prices\":[\"price_1TR1vTRuFrEhCusX9bphVKhH\"]},{\"product\":\"prod_UPrekhntN0P9fp\",\"prices\":[\"price_1TR1vURuFrEhCusXvIMtZ3C4\"]}]" \
  --features.subscription_cancel.enabled=true \
  --features.invoice_history.enabled=true \
  --features.payment_method_update.enabled=true \
  --business_profile.headline="Vesperdrop billing"
```

Expected: returns a configuration JSON with an `id` like `bpc_...`. Record this ID in the PR description for prod mirroring later.

If a default configuration already exists and Stripe rejects creation, update it instead with `stripe billing_portal configurations update bpc_<existing_id>` using the same `--features.*` flags.

- [ ] **Step 4: Add the 3 missing price IDs to `.env.local`**

Append these lines to `.env.local` (do NOT replace existing keys):

```
STRIPE_STARTER_PRICE_ID=price_1TR1vSRuFrEhCusXcjF64hLx
STRIPE_STUDIO_PRICE_ID=price_1TR1vTRuFrEhCusX9bphVKhH
STRIPE_AGENCY_PRICE_ID=price_1TR1vURuFrEhCusXvIMtZ3C4
```

- [ ] **Step 5: Update `.env.local.example`**

Replace the line `STRIPE_PRO_PRICE_ID=price_...` with the 4-key block:

```
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_STUDIO_PRICE_ID=price_...
STRIPE_AGENCY_PRICE_ID=price_...
```

- [ ] **Step 6: Commit the example file (only)**

```bash
git add .env.local.example
git commit -m "chore(env): require all 4 stripe tier price IDs"
```

`.env.local` itself is gitignored — do not stage it.

Per project policy, do NOT run `vercel env pull` or `vercel env add`. Surface the 3 new keys to the user separately when they're ready to deploy.

---

## Task 1: Plan catalog with helpers + tests

Create the single source of truth that both the marketing pricing page and the new account page will consume. Write tests first.

**Files:**
- Create: `src/lib/plans.ts`
- Create: `src/lib/plans.test.ts`
- Modify: `src/lib/env.ts` (lines 21–24)

- [ ] **Step 1: Write the failing test for `priceIdForPlan`**

Create `src/lib/plans.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_STARTER_PRICE_ID: "price_starter_test",
    STRIPE_PRO_PRICE_ID: "price_pro_test",
    STRIPE_STUDIO_PRICE_ID: "price_studio_test",
    STRIPE_AGENCY_PRICE_ID: "price_agency_test",
  },
}));

import { priceIdForPlan, PLAN_CATALOG, PAID_PLAN_SLUGS } from "./plans";

describe("priceIdForPlan", () => {
  it("returns the env-backed price ID for each paid plan", () => {
    expect(priceIdForPlan("starter")).toBe("price_starter_test");
    expect(priceIdForPlan("pro")).toBe("price_pro_test");
    expect(priceIdForPlan("studio")).toBe("price_studio_test");
    expect(priceIdForPlan("agency")).toBe("price_agency_test");
  });

  it("throws on the free slug (no price)", () => {
    expect(() => priceIdForPlan("free" as never)).toThrow();
  });

  it("throws on unknown slug", () => {
    expect(() => priceIdForPlan("enterprise" as never)).toThrow();
  });
});

describe("PLAN_CATALOG", () => {
  it("has an entry for every paid slug", () => {
    for (const slug of PAID_PLAN_SLUGS) {
      expect(PLAN_CATALOG[slug]).toBeDefined();
      expect(PLAN_CATALOG[slug].priceIdEnv).not.toBeNull();
    }
  });

  it("free entry has null priceIdEnv", () => {
    expect(PLAN_CATALOG.free.priceIdEnv).toBeNull();
  });

  it("pro is marked recommended", () => {
    expect(PLAN_CATALOG.pro.recommended).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- plans.test
```

Expected: FAIL with module-not-found error for `./plans`.

- [ ] **Step 3: Create `src/lib/plans.ts`**

```ts
import "server-only";
import { env } from "@/lib/env";

export type PlanSlug = "free" | "starter" | "pro" | "studio" | "agency";

export interface PlanRecord {
  slug: PlanSlug;
  label: string;
  price: number;
  credits: number;
  perCredit: string;
  priceIdEnv: keyof typeof env | null;
  recommended?: boolean;
  features: string[];
}

export const PAID_PLAN_SLUGS = ["starter", "pro", "studio", "agency"] as const;
export type PaidPlanSlug = (typeof PAID_PLAN_SLUGS)[number];

export const PLAN_CATALOG: Record<PlanSlug, PlanRecord> = {
  free: {
    slug: "free",
    label: "Free",
    price: 0,
    credits: 0,
    perCredit: "—",
    priceIdEnv: null,
    features: [
      "1 full-resolution HD generation",
      "5 watermarked 720p previews",
      "All scene presets",
      "Email support",
    ],
  },
  starter: {
    slug: "starter",
    label: "Starter",
    price: 19,
    credits: 50,
    perCredit: "38¢",
    priceIdEnv: "STRIPE_STARTER_PRICE_ID",
    features: [
      "50 credits / month",
      "Full resolution, no watermark",
      "All scene presets",
      "Email support",
    ],
  },
  pro: {
    slug: "pro",
    label: "Pro",
    price: 49,
    credits: 200,
    perCredit: "25¢",
    priceIdEnv: "STRIPE_PRO_PRICE_ID",
    recommended: true,
    features: [
      "200 credits / month",
      "Full resolution, no watermark",
      "All scene presets + custom prompts",
      "Priority generation queue",
      "Cancel any time",
    ],
  },
  studio: {
    slug: "studio",
    label: "Studio",
    price: 149,
    credits: 1000,
    perCredit: "15¢",
    priceIdEnv: "STRIPE_STUDIO_PRICE_ID",
    features: [
      "1,000 credits / month",
      "Full resolution, no watermark",
      "All scene presets + custom prompts",
      "Priority generation queue",
      "Bulk download & CSV export",
      "Cancel any time",
    ],
  },
  agency: {
    slug: "agency",
    label: "Agency",
    price: 499,
    credits: 5000,
    perCredit: "10¢",
    priceIdEnv: "STRIPE_AGENCY_PRICE_ID",
    features: [
      "5,000 credits / month",
      "Full resolution, no watermark",
      "All scene presets + custom prompts",
      "Priority generation queue",
      "Bulk download & CSV export",
      "Dedicated Slack support",
      "Cancel any time",
    ],
  },
};

export function isPaidPlanSlug(value: string): value is PaidPlanSlug {
  return (PAID_PLAN_SLUGS as readonly string[]).includes(value);
}

export function priceIdForPlan(slug: PaidPlanSlug): string {
  const record = PLAN_CATALOG[slug];
  if (!record || !record.priceIdEnv) {
    throw new Error(`No Stripe price ID configured for plan "${slug}"`);
  }
  const value = env[record.priceIdEnv];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`env.${record.priceIdEnv} is not set`);
  }
  return value;
}
```

Note: `import "server-only"` is intentional — `priceIdForPlan` reads from server env. The exported `PLAN_CATALOG` is plain data and is safe to import from server components, but the file is server-side only. Client components that need plan metadata (the marketing pricing cards, the plan grid) consume the catalog via a server component prop, not a direct import.

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm test -- plans.test
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Promote env keys from optional to required**

Modify `src/lib/env.ts` lines 21–24. Replace:

```ts
  STRIPE_STARTER_PRICE_ID: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().min(1),
  STRIPE_STUDIO_PRICE_ID: z.string().optional(),
  STRIPE_AGENCY_PRICE_ID: z.string().optional(),
```

With:

```ts
  STRIPE_STARTER_PRICE_ID: z.string().min(1),
  STRIPE_PRO_PRICE_ID: z.string().min(1),
  STRIPE_STUDIO_PRICE_ID: z.string().min(1),
  STRIPE_AGENCY_PRICE_ID: z.string().min(1),
```

- [ ] **Step 6: Run lint to confirm env loads**

```bash
pnpm lint
```

Expected: no TypeScript errors. (The `env` schema is parsed at module load; this also confirms `.env.local` has the 3 new keys from Task 0 step 4.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/plans.ts src/lib/plans.test.ts src/lib/env.ts
git commit -m "feat(plans): add shared plan catalog with priceIdForPlan helper"
```

---

## Task 2: Refactor `pricing-cards.tsx` to consume the catalog

Pull the inline `TIERS` array out of the marketing component so the pricing page and the account page are guaranteed to agree. This is the smallest mechanical change with no behavior delta.

**Files:**
- Modify: `src/components/marketing/pricing-cards.tsx` (lines 6–77)
- Modify: `src/app/(marketing)/pricing/page.tsx` (pass catalog as prop)

- [ ] **Step 1: Update the pricing page to pass catalog data**

Read the current `src/app/(marketing)/pricing/page.tsx`. Inside the page (which is a server component), import the catalog and pass the paid tiers to the client component.

Add at the top of the file:

```ts
import { PLAN_CATALOG, PAID_PLAN_SLUGS } from "@/lib/plans";
```

Where `<PricingCards />` is rendered, replace with:

```tsx
<PricingCards tiers={PAID_PLAN_SLUGS.map((slug) => PLAN_CATALOG[slug])} />
```

- [ ] **Step 2: Update `pricing-cards.tsx` to accept tiers prop**

In `src/components/marketing/pricing-cards.tsx`:

1. Replace lines 6–77 (the inline `TIERS` constant) with this prop-driven equivalent (`ONE_TIME_PACKS` at lines 79–83 stays):

```ts
import type { PlanRecord } from "@/lib/plans";

interface Tier extends PlanRecord {
  cta: string;
  href: string;
  effectivePerCredit: { monthly: string; yearly: string };
  yearlyPrice: number;
}

function toTier(record: PlanRecord): Tier {
  const yearlyPrice = Math.round(record.price * 0.8);
  const yearlyPerCredit =
    record.credits > 0
      ? `${Math.round((yearlyPrice * 100) / record.credits)}¢`
      : record.perCredit;
  return {
    ...record,
    cta: `Start ${record.label}`,
    href: `/api/stripe/checkout?plan=${record.slug}`,
    effectivePerCredit: { monthly: record.perCredit, yearly: yearlyPerCredit },
    yearlyPrice,
  };
}
```

2. Change the function signature (currently around line 85):

```tsx
export function PricingCards({ tiers: tierRecords }: { tiers: PlanRecord[] }) {
  const tiers = tierRecords.map(toTier);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
```

3. Inside the `TIERS.map(...)` block (line 189), replace `TIERS` with `tiers`. Inside the Pro hero card (line 152) replace the literal `49`/`39` with `tiers.find((t) => t.slug === "pro")?.price` and the yearly equivalent — easiest approach:

```tsx
{(() => {
  const proTier = tiers.find((t) => t.slug === "pro");
  if (!proTier) return null;
  return (
    <span className="font-serif text-5xl font-light">
      ${billing === "monthly" ? proTier.price : proTier.yearlyPrice}
    </span>
  );
})()}
```

(The Free hero card uses no tier data — leave it inline.)

4. The `Feature` helper component at the bottom of the file is unchanged.

- [ ] **Step 3: Run lint + the marketing pricing path manually**

```bash
pnpm lint
```

Expected: no TypeScript errors.

```bash
pnpm dev
```

Open `http://localhost:3000/pricing` in a browser. Confirm:
- All 4 tier rows render with correct labels, monthly prices ($19/$49/$149/$499), credit counts, and per-credit values.
- Toggle between monthly/yearly — each row's price updates (yearly = round(monthly × 0.8) for now; yearly billing is deferred but the toggle keeps its existing visual behavior).
- "Most popular" badge still appears on Pro.

Stop the dev server (Ctrl-C).

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/pricing-cards.tsx src/app/\(marketing\)/pricing/page.tsx
git commit -m "refactor(pricing): drive pricing-cards from PLAN_CATALOG"
```

---

## Task 3: Wire `?plan=` through the checkout route

The checkout route already does everything except read the plan slug. Replace the hard-coded `STRIPE_PRO_PRICE_ID` reference with a slug-driven lookup.

**Files:**
- Modify: `src/app/api/stripe/checkout/route.ts` (lines 1–47)

- [ ] **Step 1: Update the checkout route**

Replace the entire contents of `src/app/api/stripe/checkout/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { isPaidPlanSlug, priceIdForPlan, PAID_PLAN_SLUGS } from "@/lib/plans";

export const runtime = "nodejs";

const DEFAULT_PLAN = "pro" as const;

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in?next=/pricing", req.url), { status: 303 });
  }

  const url = new URL(req.url);
  const requestedPlan = url.searchParams.get("plan");
  if (requestedPlan && !isPaidPlanSlug(requestedPlan)) {
    // Unknown slug came from somewhere we don't trust — bounce to pricing rather than 500.
    return NextResponse.redirect(new URL("/pricing", req.url), { status: 303 });
  }
  const plan = (requestedPlan as (typeof PAID_PLAN_SLUGS)[number] | null) ?? DEFAULT_PLAN;
  const priceId = priceIdForPlan(plan);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email!,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin = new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/account?upgraded=1`,
    cancel_url: `${origin}/pricing`,
    allow_promotion_codes: true,
    metadata: { plan_slug: plan, user_id: user.id },
  });
  return NextResponse.redirect(session.url!, { status: 303 });
}
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

```bash
pnpm dev
```

Sign in as a free-tier test user. Navigate (or curl with cookies) to `http://localhost:3000/api/stripe/checkout?plan=studio`. Expected: redirected to a Stripe Checkout page where the line item shows "Vesperdrop Studio · $149/month".

Try `?plan=bogus`. Expected: redirected to `/pricing`.

Try with no `?plan=`. Expected: redirected to a Pro checkout (preserves prior behavior).

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts
git commit -m "feat(stripe/checkout): honor ?plan= query param across all 4 tiers"
```

---

## Task 4: Wire `?to=` through the portal route

Existing subscribers click "Switch to Studio" on the account page → this route. We look up their active subscription and hand Stripe a pre-filled flow_data so the customer just clicks "Confirm" on Stripe's UI.

**Files:**
- Modify: `src/app/api/stripe/portal/route.ts` (entire file)

- [ ] **Step 1: Replace the portal route**

Replace the entire contents of `src/app/api/stripe/portal/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { isPaidPlanSlug, priceIdForPlan } from "@/lib/plans";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", req.url), { status: 303 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.redirect(new URL("/account", req.url), { status: 303 });
  }
  const customerId = profile.stripe_customer_id;

  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const returnUrl = new URL("/account", req.url).toString();

  // No target plan — open the portal home (invoices, payment method, cancel).
  if (!to) {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.redirect(session.url, { status: 303 });
  }

  // Validate the target slug — bad data here is a bug in our own UI.
  if (!isPaidPlanSlug(to)) {
    return new NextResponse("invalid plan", { status: 400 });
  }
  const targetPriceId = priceIdForPlan(to);

  // Find the customer's active subscription. If none, smooth-path them into checkout.
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });
  const sub = subs.data[0];
  if (!sub) {
    return NextResponse.redirect(
      new URL(`/api/stripe/checkout?plan=${to}`, req.url),
      { status: 303 },
    );
  }
  const itemId = sub.items.data[0]?.id;
  if (!itemId) {
    // Edge case: subscription with no items. Fall back to portal home.
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.redirect(session.url, { status: 303 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    flow_data: {
      type: "subscription_update_confirm",
      subscription_update_confirm: {
        subscription: sub.id,
        items: [{ id: itemId, price: targetPriceId, quantity: 1 }],
      },
    },
  });
  return NextResponse.redirect(session.url, { status: 303 });
}
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no errors. (Stripe types include `flow_data.subscription_update_confirm`.)

- [ ] **Step 3: Manual smoke test**

This requires a test user already on a paid plan. If you don't have one, complete a checkout flow from Task 3 first. Then:

```bash
pnpm dev
```

Hit `http://localhost:3000/api/stripe/portal?to=studio` while signed in. Expected: redirected to a Stripe Customer Portal page that pre-renders a "Confirm your update" screen showing the proration math from current plan → Studio at $149/month.

Hit `http://localhost:3000/api/stripe/portal` (no params). Expected: portal home with "Plan" / "Payment method" / "Invoice history" / "Cancel plan".

Hit `http://localhost:3000/api/stripe/portal?to=bogus`. Expected: 400.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stripe/portal/route.ts
git commit -m "feat(stripe/portal): pre-fill subscription_update_confirm via ?to= param"
```

---

## Task 5: Plan summary card (server component)

Render the top-of-page "current plan" card. Fetches live state from Stripe to show `cancel_at_period_end` and the canonical `current_period_end`. Falls back to DB-only if Stripe is unreachable.

**Files:**
- Create: `src/components/app/plan-summary-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
import "server-only";
import Link from "next/link";
import { stripe } from "@/lib/stripe/server";
import { PLAN_CATALOG, type PlanSlug } from "@/lib/plans";

interface Props {
  plan: PlanSlug;
  creditsRemaining: number;
  stripeCustomerId: string | null;
  fallbackRenewsAt: string | null;
}

interface LiveSubState {
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
}

async function fetchLiveSubState(customerId: string | null): Promise<LiveSubState | null> {
  if (!customerId) return null;
  try {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const sub = subs.data[0];
    if (!sub) return { renewsAt: null, cancelAtPeriodEnd: false };
    const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
    return {
      renewsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    };
  } catch (err) {
    console.error("plan-summary-card: stripe lookup failed", err);
    return null;
  }
}

export async function PlanSummaryCard({
  plan,
  creditsRemaining,
  stripeCustomerId,
  fallbackRenewsAt,
}: Props) {
  const record = PLAN_CATALOG[plan];
  const live = await fetchLiveSubState(stripeCustomerId);
  const renewsAtIso = live?.renewsAt ?? fallbackRenewsAt;
  const renewsAt = renewsAtIso ? new Date(renewsAtIso) : null;
  const cancelAtPeriodEnd = live?.cancelAtPeriodEnd ?? false;

  return (
    <div className="border border-[var(--color-line)] rounded p-6 bg-[var(--color-cream)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            Current plan
          </p>
          <p className="font-serif text-3xl mt-1">{record.label}</p>
          <p className="text-sm text-[var(--color-ink-2)] mt-2">
            {creditsRemaining} credit{creditsRemaining === 1 ? "" : "s"} remaining
            {renewsAt ? (
              <>
                {" · "}
                {cancelAtPeriodEnd ? "Cancels" : "Renews"} {renewsAt.toLocaleDateString()}
              </>
            ) : null}
          </p>
          {cancelAtPeriodEnd ? (
            <p className="mt-2 inline-block rounded-full bg-[var(--color-paper-2)] px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-[var(--color-ink-3)]">
              SCHEDULED TO CANCEL
            </p>
          ) : null}
        </div>
        {stripeCustomerId ? (
          <Link
            href="/api/stripe/portal"
            className="text-sm underline text-[var(--color-ink-2)] hover:text-[var(--color-ember)]"
          >
            Manage billing →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/plan-summary-card.tsx
git commit -m "feat(account): add plan summary card with live Stripe state"
```

---

## Task 6: Plan grid (client component)

Renders 4 cards for the paid tiers with state-dependent CTAs.

**Files:**
- Create: `src/components/app/plan-grid.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import type { PlanRecord, PlanSlug } from "@/lib/plans";
import { track } from "@/lib/analytics";

interface Props {
  tiers: PlanRecord[];
  currentPlan: PlanSlug;
}

export function PlanGrid({ tiers, currentPlan }: Props) {
  const isFree = currentPlan === "free";
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {tiers.map((tier) => {
        const isCurrent = tier.slug === currentPlan;
        const cta = ctaFor({ tier, isFree, isCurrent });
        return (
          <div
            key={tier.slug}
            className={`relative flex flex-col rounded-xl border p-5 ${
              tier.recommended
                ? "border-[var(--color-ink)] bg-[var(--color-paper-2)]"
                : "border-[var(--color-line)] bg-[var(--color-cream)]"
            }`}
          >
            {tier.recommended ? (
              <span className="absolute -top-2 left-4 rounded-full bg-[var(--color-ember)] px-2 py-0.5 font-mono text-[9px] tracking-[0.14em] text-[var(--color-cream)]">
                MOST POPULAR
              </span>
            ) : null}
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
              {tier.label}
            </p>
            <p className="mt-3 font-serif text-3xl">${tier.price}<span className="text-sm text-[var(--color-ink-3)]">/mo</span></p>
            <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-[var(--color-ink-3)]">
              {tier.credits.toLocaleString()} CREDITS · {tier.perCredit}/CREDIT
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--color-ink-2)]">
              {tier.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--color-ink-3)]" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-5">{cta}</div>
          </div>
        );
      })}
    </div>
  );
}

function ctaFor({
  tier,
  isFree,
  isCurrent,
}: {
  tier: PlanRecord;
  isFree: boolean;
  isCurrent: boolean;
}) {
  if (isCurrent) {
    return (
      <span className="inline-flex w-full justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-paper-2)] px-4 py-2 text-sm text-[var(--color-ink-3)]">
        Current plan
      </span>
    );
  }
  if (isFree) {
    return (
      <a
        href={`/api/stripe/checkout?plan=${tier.slug}`}
        onClick={() => track("plan_choose_clicked", { plan: tier.slug, location: "account" })}
        className="inline-flex w-full justify-center rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-cream)] hover:bg-[var(--color-ink-2)]"
      >
        Choose {tier.label}
      </a>
    );
  }
  return (
    <a
      href={`/api/stripe/portal?to=${tier.slug}`}
      onClick={() => track("plan_switch_clicked", { plan: tier.slug, location: "account" })}
      className="inline-flex w-full justify-center rounded-full border border-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[var(--color-cream)]"
    >
      Switch to {tier.label}
    </a>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/plan-grid.tsx
git commit -m "feat(account): add plan grid with state-aware CTAs"
```

---

## Task 7: Wire the new account page

Wire the two new components into `/account`. Drop the old upgrade button.

**Files:**
- Modify: `src/app/(app)/account/page.tsx` (entire Plan section)
- Delete: `src/components/app/upgrade-button.tsx`

- [ ] **Step 1: Rewrite the account page**

Replace the entire contents of `src/app/(app)/account/page.tsx` with:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CheckoutSuccessTracker } from "@/components/checkout-success-tracker";
import { PlanSummaryCard } from "@/components/app/plan-summary-card";
import { PlanGrid } from "@/components/app/plan-grid";
import { PAID_PLAN_SLUGS, PLAN_CATALOG, type PlanSlug } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/account");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, stripe_customer_id, plan_renews_at, credits_balance")
    .eq("id", user.id)
    .single();

  const { upgraded } = await searchParams;
  const plan: PlanSlug = (profile?.plan as PlanSlug | undefined) ?? "free";
  const tiers = PAID_PLAN_SLUGS.map((slug) => PLAN_CATALOG[slug]);

  return (
    <div className="space-y-8 max-w-5xl">
      {upgraded === "1" ? <CheckoutSuccessTracker source="subscription" /> : null}
      <header>
        <h1 className="font-serif text-3xl">Account</h1>
        <p className="text-sm text-[var(--color-ink-3)]">{user.email}</p>
      </header>

      <section className="space-y-5">
        <PlanSummaryCard
          plan={plan}
          creditsRemaining={profile?.credits_balance ?? 0}
          stripeCustomerId={profile?.stripe_customer_id ?? null}
          fallbackRenewsAt={profile?.plan_renews_at ?? null}
        />
        <PlanGrid tiers={tiers} currentPlan={plan} />
        <p className="text-xs text-[var(--color-ink-3)]">
          Need more this month? Top-up packs coming soon.
        </p>
      </section>

      <section className="border border-[var(--color-line)] rounded p-6 bg-[var(--color-cream)]">
        <h2 className="font-serif text-xl mb-4">Security</h2>
        <Link
          href="/account/mfa"
          className="text-sm underline text-[var(--color-ink-2)] hover:text-[var(--color-ember)] transition-colors"
        >
          Two-factor authentication (TOTP) →
        </Link>
      </section>

      <form action="/api/auth/sign-out" method="post">
        <button className="underline text-sm text-[var(--color-ink-3)]">
          Sign out
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Delete the old upgrade button**

```bash
rm src/components/app/upgrade-button.tsx
```

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no errors. If anything still imports `upgrade-button`, the import will fail and you must remove it.

- [ ] **Step 4: Manual visual check**

```bash
pnpm dev
```

In a browser, sign in with three different test users (or fake the `profile.plan` column directly via Supabase Studio):

1. **Free user** (`plan = "free"`): visit `/account`. Expected:
   - Summary card shows "Free", 0 (or N) credits, no renewal date, no "Manage billing" link.
   - Plan grid shows 4 cards, each with a "Choose X" CTA.
2. **Pro user** (`plan = "pro"`): expected:
   - Summary card shows "Pro", credit count, renewal date, "Manage billing →" link.
   - Pro card shows "Current plan" disabled pill.
   - Other 3 cards show "Switch to X" CTAs that link to `/api/stripe/portal?to=...`.
3. **Studio user** (`plan = "studio"`): same shape as Pro, but Studio is "Current plan".

Click a "Switch to X" link from the Pro user and confirm it lands on Stripe's pre-filled confirm-update screen. Cancel the flow (don't actually switch).

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/account/page.tsx
git rm src/components/app/upgrade-button.tsx
git commit -m "feat(account): replace plan section with summary card + grid"
```

---

## Task 8: Extend webhook tests for all 4 tier mappings

The webhook already has the `priceIdToPlan` map for all 4 tiers, but the test file mocks the env with three of them as `undefined`. Update the mock and add per-tier mapping cases.

**Files:**
- Modify: `src/lib/stripe/webhook.test.ts`

- [ ] **Step 1: Update the env mock**

In `src/lib/stripe/webhook.test.ts` lines 54–61, replace:

```ts
vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_PRO_PRICE_ID: "price_dummy",
    STRIPE_STARTER_PRICE_ID: undefined,
    STRIPE_STUDIO_PRICE_ID: undefined,
    STRIPE_AGENCY_PRICE_ID: undefined,
  },
}));
```

With:

```ts
vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_STARTER_PRICE_ID: "price_starter",
    STRIPE_PRO_PRICE_ID: "price_pro",
    STRIPE_STUDIO_PRICE_ID: "price_studio",
    STRIPE_AGENCY_PRICE_ID: "price_agency",
  },
}));
```

- [ ] **Step 2: Update the existing Stripe SDK mock**

Lines 41–52 currently return a fixed price ID `"price_dummy"`. Make it dynamic so per-test cases can vary the returned price. Replace lines 41–52 with:

```ts
const subscriptionRetrieve = vi.fn();
vi.mock("@/lib/stripe/server", () => ({
  stripe: {
    subscriptions: {
      retrieve: (...a: unknown[]) => subscriptionRetrieve(...a),
    },
  },
}));
```

Add to the `beforeEach` block (around line 77):

```ts
  subscriptionRetrieve.mockReset().mockResolvedValue({
    id: "sub_Y",
    status: "active",
    items: { data: [{ price: { id: "price_pro" } }] },
    current_period_end: 1800000000,
  });
```

(Note the price ID changes from `price_dummy` to `price_pro` to match the new env mock.)

- [ ] **Step 3: Add the per-tier credit-grant test**

After the existing `"grants credits on invoice.payment_succeeded"` test (around line 137), add:

```ts
it.each([
  { priceId: "price_starter", plan: "starter", credits: 50 },
  { priceId: "price_pro",     plan: "pro",     credits: 200 },
  { priceId: "price_studio",  plan: "studio",  credits: 1000 },
  { priceId: "price_agency",  plan: "agency",  credits: 5000 },
])("maps $priceId to $plan with $credits credits", async ({ priceId, plan, credits }) => {
  subscriptionRetrieve.mockResolvedValueOnce({
    id: "sub_Y",
    status: "active",
    items: { data: [{ price: { id: priceId } }] },
    current_period_end: 1800000000,
  });
  await handleStripeEvent({
    id: `evt_tier_${plan}`,
    type: "invoice.payment_succeeded",
    data: {
      object: {
        customer: "cus_X",
        subscription: "sub_Y",
        billing_reason: "subscription_create",
      },
    },
  } as never);
  expect(rpcRefill).toHaveBeenCalledWith(
    expect.objectContaining({ p_plan: plan, p_credits: credits }),
  );
});
```

- [ ] **Step 4: Run the tests**

```bash
pnpm test -- webhook.test
```

Expected: all existing tests pass plus 4 new tier-mapping cases.

- [ ] **Step 5: Run the full test suite**

```bash
pnpm test
```

Expected: all tests pass (`plans.test`, `webhook.test`, `watermark.test`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe/webhook.test.ts
git commit -m "test(stripe/webhook): cover all 4 tier price ID mappings"
```

---

## Task 9: Final verification

End-to-end check that everything works together.

- [ ] **Step 1: Run lint and tests**

```bash
pnpm lint && pnpm test
```

Expected: both green.

- [ ] **Step 2: Boot the dev server**

```bash
pnpm dev
```

In a separate terminal, forward the Stripe webhook so subscription events reach localhost:

```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

- [ ] **Step 3: Run through the 5 manual scenarios**

In a browser:

1. **Free → Pro via /pricing.** Sign in as a free user. Click "Start Pro" on `/pricing`. Complete Stripe checkout with test card `4242 4242 4242 4242`. Land on `/account?upgraded=1`. Confirm the summary card now shows "Pro" and the Pro card in the grid shows "Current plan".

2. **Free → Starter via /account grid.** Use a different free user. Visit `/account`. Click "Choose Starter" on the grid. Complete checkout. Confirm landing state shows "Starter".

3. **Pro → Studio via /account grid.** Sign in as the Pro user from scenario 1. Click "Switch to Studio". Confirm Stripe shows the proration confirm-update screen pre-filled. Click "Confirm". Land back on `/account`. Wait for the webhook to fire, then refresh — summary card shows "Studio".

4. **Pro → Starter (downgrade) via /account grid.** Same flow as scenario 3 but to Starter. Confirm proration credit is shown.

5. **Manage billing.** Click "Manage billing →" on the summary card. Confirm portal home loads with "Plan", "Payment method", "Invoice history", "Cancel plan" sections.

Stop the dev server and the stripe listener.

- [ ] **Step 4: Final commit (if anything changed during QA)**

If QA surfaced fixes, commit them. Otherwise skip this step.

```bash
git status
```

If clean, you're done.

---

## Spec coverage check

| Spec section | Implemented in |
|---|---|
| §1 Shared plan catalog | Task 1 |
| §2 Backend — checkout `?plan=` | Task 3 |
| §2 Backend — portal `?to=` flow_data | Task 4 |
| §2 Backend — env promote | Task 1 step 5 |
| §2 Backend — `.env.local` / `.env.local.example` | Task 0 steps 4–6 |
| §3a Plan summary card | Task 5 |
| §3b Plan grid with state CTAs | Task 6 |
| §3c Credit packs placeholder line | Task 7 step 1 |
| §3d Sign-out preserved | Task 7 step 1 |
| §4 Rename Stripe products | Task 0 steps 1–2 |
| §4 Configure Customer Portal | Task 0 step 3 |
| §5 Error handling | Task 3 (unknown plan), Task 4 (no sub fallthrough), Task 5 (Stripe failure → DB fallback) |
| §6 Tests | Task 1 (catalog), Task 8 (webhook tiers) |
| §7 Rollout / manual QA | Task 9 |

All sections have a corresponding task. No placeholders, no forward references.
