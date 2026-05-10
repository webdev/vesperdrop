# Pricing v2 — Agent B: Stripe Money Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to work through this plan task-by-task.

**Goal:** Update checkout, webhook, and reconcile to handle the new pricing model: monthly + annual flat prices, a metered overage subscription item per paid subscription, and Agency CTA routed away from checkout. Add a daily cron that grants monthly quota chunks to annual subscribers.

**Architecture:** All Stripe-side logic flows through `src/lib/stripe/*`. Checkout sessions are created with two subscription items per paid plan: the flat tier price + the metered overage price at `quantity: 0` (Stripe requires it pre-attached so usage records have a target). Webhook now resolves the plan + interval from the subscription's flat-price item, and reconcile keeps profiles in sync. A new cron route grants monthly quota chunks to annual subs every ~28 days.

**Tech Stack:** Stripe SDK v22, Drizzle ORM, Supabase admin client, Next.js Route Handlers, Vitest.

**Owned files:**
- `src/lib/plans.ts` — **ONLY** the `PLAN_STRIPE` export (already correct after Phase 1)
- `src/lib/stripe/server.ts`
- `src/lib/stripe/webhook.ts`
- `src/lib/stripe/reconcile.ts`
- `src/lib/stripe/webhook.test.ts`
- `src/lib/stripe/reconcile.test.ts`
- `src/app/api/stripe/checkout/route.ts` (the route handler that calls `createCheckoutSession`)
- `src/app/api/cron/grant-monthly-annual-quota/route.ts` (new)
- `vercel.json` (cron registration)

**Forbidden files:** `src/components/marketing/**`, `src/app/(marketing)/**`, `src/lib/billing/quota.ts`, `src/lib/db/schema.ts`, `supabase/migrations/**`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/stripe/server.ts` | Expand | Helpers: `createCheckoutSession({ slug, interval })`, `findOverageSubscriptionItem(subscriptionId)` |
| `src/lib/stripe/webhook.ts` | Modify | Resolve plan + interval from items; grant quota on `invoice.paid` |
| `src/lib/stripe/reconcile.ts` | Modify | Sync plan + interval + period_end |
| `src/app/api/stripe/checkout/route.ts` | Modify | Parse `interval` query param, route Agency to `/contact`, call new helper |
| `src/app/api/cron/grant-monthly-annual-quota/route.ts` | Create | Daily cron that grants `monthlyQuota` to each active annual sub whose last grant ≥28d ago |
| `vercel.json` | Modify | Register the cron at `0 6 * * *` |
| `src/lib/db/schema.ts` (read-only) | — | Use only the existing shape. **Agent C may add `annualLastGrantedAt`; Agent B uses it but does not add it.** Coordinate: if `annualLastGrantedAt` is missing when this plan runs, store the timestamp in a new `annual_quota_grants` Drizzle table (single column: `userId`, `lastGrantedAt`). Decide and document. |

---

## Task B1: `createCheckoutSession` helper

**Files:**
- Modify: `src/lib/stripe/server.ts`

- [ ] **Step 1: Append the helper to `server.ts`**

```ts
import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import {
  PAID_PLAN_SLUGS,
  PLAN_STRIPE,
  isPaidPlanSlug,
  priceIdForPlan,
  overagePriceIdForPlan,
  type BillingInterval,
  type PaidPlanSlug,
} from "@/lib/plans";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

export interface CheckoutInput {
  customerEmail?: string | null;
  customerId?: string | null;
  slug: PaidPlanSlug;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<Stripe.Checkout.Session> {
  if (!isPaidPlanSlug(input.slug)) {
    throw new Error(`createCheckoutSession: invalid plan "${input.slug}"`);
  }
  const flatPriceId = priceIdForPlan(input.slug, input.interval);
  const overagePriceId = overagePriceIdForPlan(input.slug);
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.customerEmail ?? undefined,
    line_items: [
      { price: flatPriceId, quantity: 1 },
      { price: overagePriceId },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      ...input.metadata,
      vd_plan: input.slug,
      vd_interval: input.interval,
    },
    subscription_data: {
      metadata: {
        vd_plan: input.slug,
        vd_interval: input.interval,
      },
    },
  });
}

export async function findOverageSubscriptionItem(
  subscriptionId: string,
): Promise<string | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const overagePriceIds = new Set(
    PAID_PLAN_SLUGS.map((slug) => {
      try {
        return overagePriceIdForPlan(slug);
      } catch {
        return null;
      }
    }).filter((s): s is string => Boolean(s)),
  );
  const item = sub.items.data.find((i) => overagePriceIds.has(i.price.id));
  return item?.id ?? null;
}
```

The Stripe metered line item requires no `quantity` on `line_items` (omit it; Stripe rejects `quantity` on metered prices).

- [ ] **Step 2: Verify**
```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add src/lib/stripe/server.ts
git commit -m "feat(stripe): checkout helper with annual + metered overage"
```

---

## Task B2: Update `webhook.ts` to handle annual + new price map

**Files:**
- Modify: `src/lib/stripe/webhook.ts`

- [ ] **Step 1: Replace `priceIdToPlan` with an interval-aware resolver**

```ts
function resolvePriceId(priceId: string): { plan: string; interval: BillingInterval } | null {
  for (const slug of PAID_PLAN_SLUGS) {
    const cfg = PLAN_STRIPE[slug];
    if (env[cfg.monthlyPriceIdEnv] === priceId) return { plan: slug, interval: "monthly" };
    if (env[cfg.annualPriceIdEnv] === priceId) return { plan: slug, interval: "annual" };
  }
  return null;
}
```

Drop the old `priceIdToPlan` map.

- [ ] **Step 2: Update `resolveSubscription` to find the FLAT price item**

The flat price is the non-metered item:
```ts
async function resolveSubscription(subscriptionId: string): Promise<{
  plan: string;
  interval: BillingInterval;
  quota: number;
  renewsAt: string;
} | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const flatItem = sub.items.data.find(
    (i) => i.price.recurring?.usage_type !== "metered",
  );
  const priceId = flatItem?.price.id;
  const resolved = priceId ? resolvePriceId(priceId) : null;
  if (!resolved) return null;
  const quota = PLAN_MONTHLY_QUOTA[resolved.plan] ?? 0;
  const periodEnd = extractSubscriptionPeriodEnd(sub);
  const renewsAt = periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { plan: resolved.plan, interval: resolved.interval, quota, renewsAt };
}
```

- [ ] **Step 3: Update `invoice.payment_succeeded` to call `refillQuota` with the new shape**

```ts
case "invoice.payment_succeeded": {
  // ... existing customerId / userId / subscriptionId lookups
  const resolved = await resolveSubscription(subscriptionId);
  if (!resolved) {
    console.warn("[stripe-webhook] could not resolve plan from subscription", { eventId: event.id, subscriptionId });
    return;
  }
  // For annual subs we grant 1/12 of the annual quota only on FIRST invoice; the
  // monthly cron handles subsequent grants. Detect first invoice via billing_reason.
  const billingReason = (event.data.object as { billing_reason?: string }).billing_reason;
  const isFirstAnnualGrant =
    resolved.interval === "annual" && billingReason === "subscription_create";
  const grant = resolved.interval === "annual" && !isFirstAnnualGrant
    ? 0 // annual renewals are silent here; cron grants monthly slices
    : resolved.quota;
  if (grant > 0) {
    await refillQuota(userId, resolved.plan, grant, resolved.renewsAt);
  } else {
    // still update plan + renews_at without resetting balance
    await supabaseAdmin
      .from("profiles")
      .update({ plan: resolved.plan, plan_renews_at: resolved.renewsAt })
      .eq("id", userId);
  }
  safeCapture({
    distinctId: userId,
    event: "subscription_renewed",
    properties: { plan: resolved.plan, interval: resolved.interval, quota_granted: grant },
  });
  return;
}
```

- [ ] **Step 4: Update `customer.subscription.updated` to resolve interval as well**

Use the same `resolveSubscription` helper. Update profile with `plan` and `plan_renews_at` only. If new field `plan_billing_interval` exists in the schema (coordinate with Agent C — see File Structure note), set it too.

- [ ] **Step 5: Update tests in `src/lib/stripe/webhook.test.ts`**

The test fixtures use the old `STRIPE_PRO_PRICE_ID` env. Update them to use `STRIPE_PRO_PRICE_ID_MONTHLY` / `_ANNUAL` as appropriate, and add at least:
- A test for `invoice.payment_succeeded` on a monthly Pro sub → `refillQuota` called with 75.
- A test for `invoice.payment_succeeded` on an annual Pro sub with `billing_reason: "subscription_create"` → `refillQuota` called with 75 (first month).
- A test for `invoice.payment_succeeded` on an annual Pro sub with `billing_reason: "subscription_cycle"` → `refillQuota` NOT called; profile plan/renews_at still updated.

Match the existing test style (these tests already exist for the credits version; copy the pattern).

- [ ] **Step 6: Run tests**
```bash
pnpm test src/lib/stripe/webhook.test.ts
```

- [ ] **Step 7: Commit**
```bash
git add src/lib/stripe/webhook.ts src/lib/stripe/webhook.test.ts
git commit -m "feat(stripe): webhook handles annual + metered overage"
```

---

## Task B3: Update `reconcile.ts`

**Files:**
- Modify: `src/lib/stripe/reconcile.ts`

- [ ] **Step 1: Replace `priceIdToPlan` with the same `resolvePriceId` helper**

Use the same logic as in `webhook.ts` (extract to a shared helper if you prefer; otherwise duplicate is fine for now).

- [ ] **Step 2: In `pickPrimary`, ignore metered items when picking the primary**

```ts
function pickPrimary(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  let best: { sub: Stripe.Subscription; quota: number } | null = null;
  for (const sub of subs) {
    const flatItem = sub.items.data.find(
      (i) => i.price.recurring?.usage_type !== "metered",
    );
    const priceId = flatItem?.price.id;
    const resolved = priceId ? resolvePriceId(priceId) : null;
    const quota = resolved ? (PLAN_MONTHLY_QUOTA[resolved.plan] ?? 0) : 0;
    if (!best || quota > best.quota || (quota === best.quota && sub.created > best.sub.created)) {
      best = { sub, quota };
    }
  }
  return best?.sub ?? null;
}
```

- [ ] **Step 3: Update tests**

Same patterns as Agent B Task B2 Step 5. Tests in `reconcile.test.ts`.

- [ ] **Step 4: Commit**
```bash
git add src/lib/stripe/reconcile.ts src/lib/stripe/reconcile.test.ts
git commit -m "feat(stripe): reconcile handles annual + metered items"
```

---

## Task B4: Update `src/app/api/stripe/checkout/route.ts`

**Files:**
- Modify: `src/app/api/stripe/checkout/route.ts`

- [ ] **Step 1: Read the existing route to understand its shape**

Find the file and read it. It already accepts `?plan=X`. Add `?interval=monthly|annual`.

- [ ] **Step 2: Add interval parsing + Agency routing**

```ts
import { isPaidPlanSlug, PLAN_MARKETING, type BillingInterval } from "@/lib/plans";

// inside the GET/POST handler:
const url = new URL(req.url);
const planParam = url.searchParams.get("plan");
const intervalParam = url.searchParams.get("interval");
const interval: BillingInterval = intervalParam === "annual" ? "annual" : "monthly";

if (!planParam || !isPaidPlanSlug(planParam)) {
  return NextResponse.redirect(new URL("/pricing", req.url));
}

// Agency CTA never goes through checkout
if (PLAN_MARKETING[planParam].ctaTarget === "contact") {
  return NextResponse.redirect(new URL(`/contact?source=pricing-${planParam}`, req.url));
}

const session = await createCheckoutSession({
  slug: planParam,
  interval,
  customerEmail: user.email,
  customerId: profile.stripe_customer_id,
  successUrl: `${baseUrl}/account?checkout=success&plan=${planParam}&interval=${interval}`,
  cancelUrl: `${baseUrl}/pricing?checkout=cancelled`,
});

return NextResponse.redirect(session.url ?? `${baseUrl}/pricing`);
```

- [ ] **Step 3: Commit**
```bash
git add src/app/api/stripe/checkout/route.ts
git commit -m "feat(stripe): checkout route accepts interval and routes Agency to contact"
```

---

## Task B5: Daily cron — grant monthly quota to annual subscribers

**Files:**
- Create: `src/app/api/cron/grant-monthly-annual-quota/route.ts`
- Modify: `vercel.json`

**Schema coordination:** `annual_last_granted_at` and `plan_billing_interval` are landed by Phase 1 Task 6 as the cross-agent contract. Agent B reads them; no schema additions needed.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { refillQuota } from "@/lib/db/quota";
import { PLAN_QUOTA } from "@/lib/plans";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const { data: subs, error } = await supabaseAdmin
    .from("profiles")
    .select("id, plan, annual_last_granted_at, plan_renews_at")
    .eq("plan_billing_interval", "annual")
    .or(`annual_last_granted_at.is.null,annual_last_granted_at.lt.${cutoff}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let granted = 0;
  for (const sub of subs ?? []) {
    const slug = sub.plan as keyof typeof PLAN_QUOTA;
    const quota = PLAN_QUOTA[slug]?.monthlyQuota ?? 0;
    if (quota <= 0) continue;
    await refillQuota(sub.id, sub.plan, quota, sub.plan_renews_at ?? new Date().toISOString());
    await supabaseAdmin
      .from("profiles")
      .update({ annual_last_granted_at: new Date().toISOString() })
      .eq("id", sub.id);
    granted += 1;
  }
  return NextResponse.json({ granted });
}
```

This route assumes `CRON_SECRET` exists. If not in `env.ts`, add it (already exists in most Vercel-hosted repos).

- [ ] **Step 2: Register the cron in `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/grant-monthly-annual-quota", "schedule": "0 6 * * *" }
  ]
}
```

Merge with any existing crons; don't replace the file blindly.

- [ ] **Step 3: Commit**
```bash
git add src/app/api/cron/grant-monthly-annual-quota/route.ts vercel.json
git commit -m "feat(stripe): daily cron grants monthly quota to annual subscribers"
```

---

## Self-Review

- ✅ Checkout supports `interval` and pre-attaches the metered overage item.
- ✅ Webhook resolves plan + interval from the flat (non-metered) subscription item.
- ✅ Annual subscriber first-invoice grants 1/12; subsequent annual cycle invoices don't double-grant.
- ✅ Cron handles ongoing monthly grants for annual subs.
- ✅ Agency routes to `/contact` from the checkout route handler (defense in depth — Agent A also routes from the UI).
- ✅ All cross-agent dependencies (schema columns + stub helper) landed by Phase 1 Task 6. No coupling to Agent C's merge order.
- ⚠️ Open: `CRON_SECRET` must exist in `env.ts`. If not, add it as a required string in Task B5 Step 1.
