# Pricing v2 — Phase 1 Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to work through this plan task-by-task. Phase 1 is intentionally orchestrator-driven (not dispatched to a subagent) because step 2 creates real Stripe products.

**Goal:** Land the mechanical schema rename (`credits` → `quota_units`), the new tri-export shape of `plans.ts`, and the new Stripe products + env vars so Phase 2 agents have a clean foundation.

**Architecture:** Single PR-equivalent commit series landing on `main`. The schema migration is a column rename plus RPC function renames; the `plans.ts` split keeps the same `PlanSlug` enum so consumers compile. Stripe product creation runs via the Stripe MCP, test mode first, with explicit per-tier confirmation.

**Tech Stack:** Supabase migrations, Drizzle ORM, Stripe MCP, Vercel CLI.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260510000001_rename_credits_to_quota.sql` | Create | Column rename, RPC function renames, downstream view/function adjustments |
| `src/lib/db/schema.ts` | Modify | Rename `creditsBalance` → `quotaUnitsBalance` on `profiles`; rename `creditsSpent` → `quotaUnitsSpent` on `complete_look_packs` |
| `src/lib/db/credits.ts` | Rename to `src/lib/db/quota.ts` + edit | Rename exports (`tryDeductCredits` → `tryConsumeQuota`, `refillCredits` → `refillQuota`, `addCredits` → `addQuota`, `getCreditsBalance` → `getQuotaBalance`) |
| `src/lib/db/rpc.ts` | Modify | Update RPC names to match SQL renames |
| `src/lib/plans.ts` | Modify | Split into `PLAN_MARKETING`, `PLAN_STRIPE`, `PLAN_QUOTA` exports. Keep `PlanSlug`, `PAID_PLAN_SLUGS`, `isPaidPlanSlug` for compatibility. Old `PLAN_CATALOG` + `priceIdForPlan` are removed once consumers are updated |
| `src/lib/env.ts` | Modify | Add 12 new `STRIPE_*_PRICE_ID_*` vars + `CONTACT_SLACK_WEBHOOK_URL`. Keep old `STRIPE_*_PRICE_ID` vars present but optional during transition |
| `src/lib/ai/models.ts` | Modify | Rename `PLAN_MONTHLY_CREDITS` → `PLAN_MONTHLY_QUOTA` (consumers in `webhook.ts`, `reconcile.ts` will be updated by Agent B) |
| Callsite consumers across `src/app/**` and `src/components/**` | Modify | Replace `credits_balance` selects, `creditsBalance` props, `tryDeductCredits`/`refillCredits` imports with the renamed equivalents. No behavior change — purely mechanical |

---

## Task 1: Add the migration file

**Files:**
- Create: `supabase/migrations/20260510000001_rename_credits_to_quota.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Rename profiles.credits_balance → profiles.quota_units_balance
ALTER TABLE profiles RENAME COLUMN credits_balance TO quota_units_balance;

-- Rename complete_look_packs.credits_spent → complete_look_packs.quota_units_spent
ALTER TABLE complete_look_packs RENAME COLUMN credits_spent TO quota_units_spent;

-- Rename the deduction RPC.
-- The old function returns boolean and signature is (p_user_id uuid, p_amount int).
-- Keep the body the same — just rename and reference the renamed column.
DROP FUNCTION IF EXISTS try_deduct_credits(uuid, integer);

CREATE OR REPLACE FUNCTION try_consume_quota(
  p_user_id uuid,
  p_amount integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining integer;
BEGIN
  UPDATE profiles
  SET quota_units_balance = quota_units_balance - p_amount
  WHERE id = p_user_id
    AND quota_units_balance >= p_amount
  RETURNING quota_units_balance INTO v_remaining;
  RETURN v_remaining IS NOT NULL;
END;
$$;

-- Rename the refill RPC.
DROP FUNCTION IF EXISTS refill_credits(uuid, text, integer, timestamptz);

CREATE OR REPLACE FUNCTION refill_quota(
  p_user_id uuid,
  p_plan text,
  p_quota integer,
  p_renews_at timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET plan = p_plan,
      quota_units_balance = p_quota,
      plan_renews_at = p_renews_at
  WHERE id = p_user_id;
END;
$$;
```

- [ ] **Step 2: Inspect old function bodies before committing**

Before applying, confirm the rewritten functions match the originals. Run locally:
```bash
grep -A 20 'try_deduct_credits\|refill_credits' supabase/migrations/*.sql
```
If the original bodies differ from the assumed structure above (e.g. there's a `RAISE NOTICE`, additional update on `plan_renews_at`, or audit ledger insert), update the new function bodies to preserve that behavior. **Do not skip this step** — losing audit-ledger writes would silently break billing reconciliation.

- [ ] **Step 3: Apply migration locally**

```bash
pnpm db:reset
```
Expected: all migrations apply cleanly, including the new one.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260510000001_rename_credits_to_quota.sql
git commit -m "feat(billing): rename credits → quota_units (migration)"
```

---

## Task 2: Update Drizzle schema + rename credits.ts → quota.ts

**Files:**
- Modify: `src/lib/db/schema.ts:27` (creditsBalance column)
- Modify: `src/lib/db/schema.ts:168` (creditsSpent column)
- Rename: `src/lib/db/credits.ts` → `src/lib/db/quota.ts`
- Modify: `src/lib/db/rpc.ts` (rename exports + RPC names)

- [ ] **Step 1: Update Drizzle schema**

In `src/lib/db/schema.ts`, change:
```ts
creditsBalance: integer("credits_balance").notNull().default(1),
```
to:
```ts
quotaUnitsBalance: integer("quota_units_balance").notNull().default(1),
```

And change:
```ts
creditsSpent: integer("credits_spent").notNull(),
```
to:
```ts
quotaUnitsSpent: integer("quota_units_spent").notNull(),
```

- [ ] **Step 2: Rename `src/lib/db/credits.ts` → `src/lib/db/quota.ts` and rewrite exports**

```bash
git mv src/lib/db/credits.ts src/lib/db/quota.ts
```

New contents of `src/lib/db/quota.ts`:
```ts
import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { profiles } from "./schema";
import {
  tryConsumeQuota as rpcTryConsumeQuota,
  refillQuota as rpcRefillQuota,
} from "./rpc";

export async function tryConsumeQuota(
  userId: string,
  amount: number,
): Promise<boolean> {
  return rpcTryConsumeQuota(userId, amount);
}

export async function refillQuota(
  userId: string,
  plan: string,
  quotaUnits: number,
  renewsAt: string,
): Promise<void> {
  return rpcRefillQuota(userId, plan, quotaUnits, renewsAt);
}

export async function addQuota(userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await db
    .update(profiles)
    .set({ quotaUnitsBalance: sql`${profiles.quotaUnitsBalance} + ${amount}` })
    .where(eq(profiles.id, userId));
}

export async function getQuotaBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ balance: profiles.quotaUnitsBalance })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row?.balance ?? 0;
}
```

- [ ] **Step 3: Update RPC wrapper in `src/lib/db/rpc.ts`**

Replace any `try_deduct_credits` / `refill_credits` calls with `try_consume_quota` / `refill_quota` and rename the wrapper TypeScript functions to match the new names. Inspect the file first to see the existing shape; mirror it.

- [ ] **Step 4: Run tsc to surface every consumer**

```bash
pnpm tsc --noEmit
```
Expected: a list of compile errors at every callsite that imports the old names. These become Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/quota.ts src/lib/db/rpc.ts
git commit -m "feat(billing): rename Drizzle schema + db/quota.ts module"
```

---

## Task 3: Mechanically rewrite every credits consumer

**Files (from grep at write-time — re-run before editing):**
- Modify: `src/app/(app)/app/page.tsx`
- Modify: `src/app/(app)/account/page.tsx`
- Modify: `src/app/api/runs/route.ts`
- Modify: `src/app/api/runs/[id]/complete-look/route.ts`
- Modify: `src/components/nav.tsx`
- Modify: `src/components/app/plan-summary-card.tsx`
- Modify: `src/components/app/run-form.tsx`
- Modify: `src/components/app/complete-look-button.tsx`
- Modify: `src/components/app/plan-grid.tsx`
- Modify: `src/components/checkout-success-tracker.tsx`
- Modify: `src/components/dev/mock-gen-toggle.tsx`
- Modify: `src/components/marketing/pricing-faq.tsx`
- Modify: `src/lib/workflows/process-run.ts`
- Modify: `src/lib/analytics.ts`
- Modify: `src/lib/ai/models.ts`
- Modify: `src/lib/stripe/webhook.ts`
- Modify: `src/lib/stripe/reconcile.ts`
- Modify: `src/lib/stripe/webhook.test.ts`
- Modify: `src/lib/stripe/reconcile.test.ts`

- [ ] **Step 1: Re-grep to get the authoritative list**

```bash
grep -rln "creditsBalance\|credits_balance\|getCreditsBalance\|tryDeductCredits\|refillCredits\|addCredits\|PLAN_MONTHLY_CREDITS\|refill_credits\|try_deduct_credits\|credits_spent\|creditsSpent\|@/lib/db/credits" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: For each file in the grep, apply this rename map**

| Old | New |
|---|---|
| `creditsBalance` (Drizzle field) | `quotaUnitsBalance` |
| `credits_balance` (SQL select string) | `quota_units_balance` |
| `creditsSpent` (Drizzle field) | `quotaUnitsSpent` |
| `credits_spent` (SQL select string) | `quota_units_spent` |
| `getCreditsBalance` | `getQuotaBalance` |
| `tryDeductCredits` | `tryConsumeQuota` |
| `refillCredits` | `refillQuota` |
| `addCredits` | `addQuota` |
| `PLAN_MONTHLY_CREDITS` | `PLAN_MONTHLY_QUOTA` |
| `@/lib/db/credits` | `@/lib/db/quota` |
| `try_deduct_credits` (RPC name in `db.rpc()` calls) | `try_consume_quota` |
| `refill_credits` (RPC name in `db.rpc()` calls) | `refill_quota` |

UI strings that mention "credits" / "credit" / "credit pack" / "per credit" stay as-is in this pass — they're Agent A's responsibility to rewrite into "photos" copy. The rename is **API surface only**.

Exception: `src/components/app/plan-summary-card.tsx` prop `creditsRemaining` — also rename to `quotaUnitsRemaining` since it's an internal API prop. The display label ("Credits"/"credits remaining") is Agent A copy and stays for now.

- [ ] **Step 3: Verify**

```bash
pnpm tsc --noEmit
pnpm test
```
Expected: clean typecheck. Tests pass (webhook + reconcile tests are updated as part of this step too).

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(billing): rename credits consumers to quota across codebase"
```

---

## Task 4: Split `plans.ts` into three exports (placeholders for Phase 2)

**Files:**
- Modify: `src/lib/plans.ts`

- [ ] **Step 1: Rewrite `src/lib/plans.ts`**

The new file:
```ts
import "server-only";
import { env } from "@/lib/env";

export type PlanSlug = "free" | "starter" | "pro" | "studio" | "agency";
export const PAID_PLAN_SLUGS = ["starter", "pro", "studio", "agency"] as const;
export type PaidPlanSlug = (typeof PAID_PLAN_SLUGS)[number];

export function isPaidPlanSlug(value: string): value is PaidPlanSlug {
  return (PAID_PLAN_SLUGS as readonly string[]).includes(value);
}

export type BillingInterval = "monthly" | "annual";

// ---------------------------------------------------------------------------
// PLAN_MARKETING — owned by Agent A. Phase 1 ships placeholder strings; A
// rewrites these in their slice without touching the other two exports.
// ---------------------------------------------------------------------------
export interface PlanMarketing {
  label: string;
  description: string;
  features: string[];
  badge?: "popular" | "for-agencies";
  ctaLabel: string;
  ctaTarget: "checkout" | "contact";
  perPhotoMonthlyDisplay: string;
  perPhotoAnnualDisplay: string;
  overageDisplay: string;
}

export const PLAN_MARKETING: Record<PlanSlug, PlanMarketing> = {
  free: {
    label: "Free",
    description: "Try VesperDrop on a real product. No card needed.",
    features: [
      "1 full quality photo, no watermark",
      "2 watermarked HD previews",
      "All scene presets",
      "Email support",
    ],
    ctaLabel: "Try free",
    ctaTarget: "checkout",
    perPhotoMonthlyDisplay: "",
    perPhotoAnnualDisplay: "",
    overageDisplay: "",
  },
  starter: {
    label: "Starter",
    description: "",
    features: [],
    ctaLabel: "Start Starter",
    ctaTarget: "checkout",
    perPhotoMonthlyDisplay: "$0.76 per photo",
    perPhotoAnnualDisplay: "$0.61 per photo",
    overageDisplay: "overage at $0.50",
  },
  pro: {
    label: "Pro",
    description:
      "For sellers refreshing 10 to 25 SKUs a month. 75 photos covers it cleanly.",
    features: [],
    badge: "popular",
    ctaLabel: "Start Pro",
    ctaTarget: "checkout",
    perPhotoMonthlyDisplay: "$0.52 per photo",
    perPhotoAnnualDisplay: "$0.42 per photo",
    overageDisplay: "overage at $0.50",
  },
  studio: {
    label: "Studio",
    description: "",
    features: [],
    ctaLabel: "Start Studio",
    ctaTarget: "checkout",
    perPhotoMonthlyDisplay: "$0.40 per photo",
    perPhotoAnnualDisplay: "$0.32 per photo",
    overageDisplay: "overage at $0.50",
  },
  agency: {
    label: "Agency",
    description: "",
    features: [],
    badge: "for-agencies",
    ctaLabel: "Talk to us",
    ctaTarget: "contact",
    perPhotoMonthlyDisplay: "$0.33 per photo",
    perPhotoAnnualDisplay: "$0.27 per photo",
    overageDisplay: "overage at $0.40",
  },
};

// ---------------------------------------------------------------------------
// PLAN_STRIPE — owned by Agent B. Reads env vars at access time, not at
// module load, so missing vars don't crash the marketing build.
// ---------------------------------------------------------------------------
export interface PlanStripe {
  monthlyPriceIdEnv: keyof typeof env;
  annualPriceIdEnv: keyof typeof env;
  overagePriceIdEnv: keyof typeof env;
}

export const PLAN_STRIPE: Record<PaidPlanSlug, PlanStripe> = {
  starter: {
    monthlyPriceIdEnv: "STRIPE_STARTER_PRICE_ID_MONTHLY",
    annualPriceIdEnv: "STRIPE_STARTER_PRICE_ID_ANNUAL",
    overagePriceIdEnv: "STRIPE_STARTER_PRICE_ID_OVERAGE",
  },
  pro: {
    monthlyPriceIdEnv: "STRIPE_PRO_PRICE_ID_MONTHLY",
    annualPriceIdEnv: "STRIPE_PRO_PRICE_ID_ANNUAL",
    overagePriceIdEnv: "STRIPE_PRO_PRICE_ID_OVERAGE",
  },
  studio: {
    monthlyPriceIdEnv: "STRIPE_STUDIO_PRICE_ID_MONTHLY",
    annualPriceIdEnv: "STRIPE_STUDIO_PRICE_ID_ANNUAL",
    overagePriceIdEnv: "STRIPE_STUDIO_PRICE_ID_OVERAGE",
  },
  agency: {
    monthlyPriceIdEnv: "STRIPE_AGENCY_PRICE_ID_MONTHLY",
    annualPriceIdEnv: "STRIPE_AGENCY_PRICE_ID_ANNUAL",
    overagePriceIdEnv: "STRIPE_AGENCY_PRICE_ID_OVERAGE",
  },
};

export function priceIdForPlan(
  slug: PaidPlanSlug,
  interval: BillingInterval,
): string {
  const cfg = PLAN_STRIPE[slug];
  const key = interval === "annual" ? cfg.annualPriceIdEnv : cfg.monthlyPriceIdEnv;
  const value = env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`env.${String(key)} is not set`);
  }
  return value;
}

export function overagePriceIdForPlan(slug: PaidPlanSlug): string {
  const key = PLAN_STRIPE[slug].overagePriceIdEnv;
  const value = env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`env.${String(key)} is not set`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// PLAN_QUOTA — owned by Agent C.
// ---------------------------------------------------------------------------
export interface PlanQuota {
  monthlyQuota: number;
  overageCentsPerPhoto: number;
}

export const PLAN_QUOTA: Record<PlanSlug, PlanQuota> = {
  free: { monthlyQuota: 0, overageCentsPerPhoto: 0 },
  starter: { monthlyQuota: 25, overageCentsPerPhoto: 50 },
  pro: { monthlyQuota: 75, overageCentsPerPhoto: 50 },
  studio: { monthlyQuota: 250, overageCentsPerPhoto: 50 },
  agency: { monthlyQuota: 1500, overageCentsPerPhoto: 40 },
};
```

- [ ] **Step 2: Update all imports of `PLAN_CATALOG`**

```bash
grep -rln "PLAN_CATALOG" src/ --include="*.ts" --include="*.tsx"
```

For each consumer:
- Marketing files (`pricing/page.tsx`, `pricing-cards.tsx`) — Agent A will rewrite these. For now, switch them to import from `PLAN_MARKETING + PLAN_QUOTA` and stub the per-credit display so the page builds. The actual layout rewrite happens in Agent A.
- App files (e.g. `plan-grid.tsx`, `plan-summary-card.tsx`) — switch to `PLAN_MARKETING[slug].label` and `PLAN_QUOTA[slug].monthlyQuota` so they keep rendering.

- [ ] **Step 3: Update `PLAN_MONTHLY_QUOTA` in `src/lib/ai/models.ts` to derive from `PLAN_QUOTA`**

```ts
import { PLAN_QUOTA, type PlanSlug } from "@/lib/plans";

export const PLAN_MONTHLY_QUOTA: Record<string, number> = Object.fromEntries(
  Object.entries(PLAN_QUOTA).map(([slug, { monthlyQuota }]) => [slug, monthlyQuota]),
);
```

This keeps the existing webhook + reconcile working unchanged until Agent B rewrites them.

- [ ] **Step 4: Verify**

```bash
pnpm tsc --noEmit
pnpm test
pnpm build
```
Expected: clean typecheck, tests pass, build succeeds. The pricing page will look stale (Agent A's job to fix) but must render without errors.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "feat(plans): split plans.ts into MARKETING / STRIPE / QUOTA exports"
```

---

## Task 5: Add new env vars to `src/lib/env.ts`

**Files:**
- Modify: `src/lib/env.ts`

- [ ] **Step 1: Add the new vars to the Zod schema (or equivalent)**

Inspect the current shape first — `src/lib/env.ts` uses a Zod schema or manual validation. Add these as optional strings during the transition (Phase 1 doesn't set them in production):

```ts
STRIPE_STARTER_PRICE_ID_MONTHLY: z.string().optional(),
STRIPE_STARTER_PRICE_ID_ANNUAL: z.string().optional(),
STRIPE_STARTER_PRICE_ID_OVERAGE: z.string().optional(),
STRIPE_PRO_PRICE_ID_MONTHLY: z.string().optional(),
STRIPE_PRO_PRICE_ID_ANNUAL: z.string().optional(),
STRIPE_PRO_PRICE_ID_OVERAGE: z.string().optional(),
STRIPE_STUDIO_PRICE_ID_MONTHLY: z.string().optional(),
STRIPE_STUDIO_PRICE_ID_ANNUAL: z.string().optional(),
STRIPE_STUDIO_PRICE_ID_OVERAGE: z.string().optional(),
STRIPE_AGENCY_PRICE_ID_MONTHLY: z.string().optional(),
STRIPE_AGENCY_PRICE_ID_ANNUAL: z.string().optional(),
STRIPE_AGENCY_PRICE_ID_OVERAGE: z.string().optional(),
CONTACT_SLACK_WEBHOOK_URL: z.string().url().optional(),
```

Keep the old `STRIPE_*_PRICE_ID` vars in place — they'll be removed in Phase 3 after migration is verified.

- [ ] **Step 2: Verify**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/env.ts
git commit -m "feat(env): add new Stripe price ID vars + contact webhook"
```

---

## Task 6: Land cross-agent contract (schema columns + stub helper)

Phase 2 has a circular dependency: Agent C consumes a helper Agent B defines, and Agent B's cron reads schema columns Agent C adds. Phase 1 lands both as the integration contract so each agent's worktree compiles independently.

**Files:**
- Create: `supabase/migrations/20260510000003_quota_contract.sql`
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/stripe/server.ts`

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE profiles
  ADD COLUMN plan_billing_interval text NOT NULL DEFAULT 'monthly',
  ADD COLUMN annual_last_granted_at timestamptz,
  ADD COLUMN last_failed_run_at timestamptz;

ALTER TABLE generations
  ADD COLUMN was_overage boolean NOT NULL DEFAULT false;

CREATE TABLE overage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  generation_id uuid REFERENCES generations(id) ON DELETE SET NULL,
  cents integer NOT NULL,
  stripe_usage_record_id text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  cycle_anchor timestamptz NOT NULL
);

CREATE INDEX overage_ledger_user_cycle_idx
  ON overage_ledger (user_id, cycle_anchor DESC);

CREATE UNIQUE INDEX overage_ledger_run_unique_idx
  ON overage_ledger (user_id, generation_id)
  WHERE generation_id IS NOT NULL;
```

- [ ] **Step 2: Mirror in Drizzle `src/lib/db/schema.ts`**

Add to `profiles`:
```ts
planBillingInterval: text("plan_billing_interval", { enum: ["monthly", "annual"] })
  .notNull()
  .default("monthly"),
annualLastGrantedAt: timestamp("annual_last_granted_at", { withTimezone: true }),
lastFailedRunAt: timestamp("last_failed_run_at", { withTimezone: true }),
```

Add to `generations`:
```ts
wasOverage: boolean("was_overage").notNull().default(false),
```

Add the `overageLedger` table (full definition lives in Agent C's plan; copy it verbatim — it's part of the contract).

- [ ] **Step 3: Add a stub `findOverageSubscriptionItem` to `src/lib/stripe/server.ts`**

```ts
// STUB: replaced by Agent B with real implementation. Returns null so Agent C's
// overage hook silently no-ops until B lands the real version.
export async function findOverageSubscriptionItem(
  _subscriptionId: string,
): Promise<string | null> {
  return null;
}
```

- [ ] **Step 4: Verify**
```bash
pnpm db:reset
pnpm tsc --noEmit
pnpm test
```

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20260510000003_quota_contract.sql src/lib/db/schema.ts src/lib/stripe/server.ts
git commit -m "feat(billing): cross-agent contract — schema columns + stub helper"
```

---

## Task 7: Create new Stripe products + prices in TEST mode

**Files:** None — performed via Stripe MCP by the orchestrator.

This task is intentionally manual because it mutates a live Stripe account.

- [ ] **Step 1: Confirm Stripe MCP is connected to the correct test-mode account**

Use `mcp__claude_ai_Stripe__get_stripe_account_info` and confirm `livemode: false` and account ID matches the project's test-mode account.

- [ ] **Step 2: For each tier (Starter, Pro, Studio, Agency), create one Product**

```
mcp__claude_ai_Stripe__create_product
  name: "VesperDrop Starter" (etc.)
  description: "<from PLAN_MARKETING[slug].description>"
```

Record each `product_id` returned.

- [ ] **Step 3: Create 3 prices per product (monthly flat, annual flat, metered overage)**

For each tier, run three `create_price` calls. Use these values (amounts in cents, USD):

| Tier | Monthly flat | Annual flat | Overage metered |
|---|---|---|---|
| Starter | 1900 / month | 18240 / year | 50 per unit, metered, sum |
| Pro | 3900 / month | 37440 / year | 50 per unit, metered, sum |
| Studio | 9900 / month | 95040 / year | 50 per unit, metered, sum |
| Agency | 49900 / month | 479040 / year | 40 per unit, metered, sum |

Metered price config:
- `recurring.usage_type: "metered"`
- `recurring.aggregate_usage: "sum"`
- `recurring.interval: "month"`
- `billing_scheme: "per_unit"`

Pause after each tier and confirm the IDs with the user before proceeding to the next tier.

- [ ] **Step 4: Write the test-mode price IDs to `.env.local`**

After all 12 prices are created, append to `.env.local`:
```
STRIPE_STARTER_PRICE_ID_MONTHLY=price_xxx
STRIPE_STARTER_PRICE_ID_ANNUAL=price_xxx
STRIPE_STARTER_PRICE_ID_OVERAGE=price_xxx
STRIPE_PRO_PRICE_ID_MONTHLY=price_xxx
... etc
```

- [ ] **Step 5: Add the same vars on Vercel preview + development**

For each var:
```bash
vercel env add STRIPE_STARTER_PRICE_ID_MONTHLY preview
vercel env add STRIPE_STARTER_PRICE_ID_MONTHLY development
# (paste test-mode price_xxx when prompted)
```

**Do not** add to `production` yet — Phase 3 mirrors to live mode and adds the live-mode IDs to production.

**Per user preference: never run `vercel env pull`.**

- [ ] **Step 6: Archive the four old test-mode products**

```
mcp__claude_ai_Stripe__fetch_stripe_resources → find old products by name
For each old product: stripe_api_execute → products.update with active: false
```

Confirm with user before archiving each one.

- [ ] **Step 7: Commit a note**

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)  Phase 1 Stripe test products created; old archived" \
  >> docs/superpowers/plans/2026-05-10-pricing-v2-stripe-changelog.md
git add docs/superpowers/plans/2026-05-10-pricing-v2-stripe-changelog.md
git commit -m "chore(stripe): record test-mode product creation"
```

---

## Self-Review

- ✅ Schema rename SQL is concrete (column renames + RPC drops + new function bodies).
- ✅ All API-surface renames listed (`tryDeductCredits` → `tryConsumeQuota`, etc).
- ✅ `plans.ts` split shape ships with placeholder Marketing strings so the page renders during the transition.
- ✅ Env vars added as optional during transition.
- ⚠️ Open item: confirm `try_deduct_credits` / `refill_credits` RPCs in old migrations don't write to an audit ledger that needs preserving. The migration drops + recreates; if there's audit logging, lose it. **Task 1 Step 2 catches this.**
- ✅ No reference to types/functions not defined in this plan.
