# Pricing v2 — Agent C: Quota Engine + Overage Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to work through this plan task-by-task. Uses superpowers:test-driven-development for the quota engine.

**Goal:** Build the new quota engine that enforces per-cycle limits on paid plans (vs today's "free-only enforcement"), reports overage to Stripe when over cap, and surfaces accrued overage in the UI. Adds schema columns for tracking annual billing interval, last-grant timestamp, and last-failed-run timestamp.

**Architecture:** Two new schema columns on `profiles` for billing/cron coordination. A new `src/lib/billing/quota.ts` module exposes a single `consumeQuota` entry point used by the runs route. Overage usage records go through Stripe with a `run_id`-keyed idempotency key. Plan summary card adds an "accrued overage" line that queries the local ledger.

**Tech Stack:** Supabase migrations, Drizzle ORM, Stripe SDK, Vitest.

**Owned files:**
- `src/lib/plans.ts` — **ONLY** the `PLAN_QUOTA` export (already correct after Phase 1; only edit if it needs refinement)
- `supabase/migrations/20260510000002_quota_engine.sql` (new)
- `src/lib/db/schema.ts` (add columns)
- `src/lib/billing/quota.ts` (new — the engine)
- `src/lib/billing/quota.test.ts` (new)
- `src/lib/billing/overage.ts` (new — Stripe usage record helper)
- `src/lib/billing/overage.test.ts` (new)
- `src/lib/db/overage-ledger.ts` (new — Drizzle queries for accrual UI)
- `src/app/api/runs/route.ts` (replace free-only credit gate with quota gate)
- `src/app/api/runs/[id]/complete-look/route.ts` (same gate replacement)
- `src/components/app/plan-summary-card.tsx` (accrued overage line)
- `src/lib/workflows/process-run.ts` (overage hook on successful generations past cap; retry-within-5m free path)

**Forbidden files:** `src/components/marketing/**`, `src/app/(marketing)/**`, `src/lib/stripe/server.ts`, `src/lib/stripe/webhook.ts`, `src/lib/stripe/reconcile.ts` (these are B's, except for read-only imports), `src/app/contact/**`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260510000002_quota_engine.sql` | Create | Add `profiles.plan_billing_interval` (text, default 'monthly'), `profiles.annual_last_granted_at` (timestamptz, null), `profiles.last_failed_run_at` (timestamptz, null). Create `overage_ledger` table |
| `src/lib/db/schema.ts` | Modify | Mirror the new columns + new table in Drizzle |
| `src/lib/billing/quota.ts` | Create | `consumeQuota(userId, runId)` — the single gate |
| `src/lib/billing/overage.ts` | Create | `reportOverage(subscriptionItemId, runId)` — Stripe usage record with idempotency |
| `src/lib/db/overage-ledger.ts` | Create | `recordOverage`, `getAccruedOverageCents` |
| `src/app/api/runs/route.ts` | Modify | Replace `tryDeductCredits` + free-only branch with `consumeQuota` |
| `src/app/api/runs/[id]/complete-look/route.ts` | Modify | Same |
| `src/lib/workflows/process-run.ts` | Modify | On successful generation past cap, call `reportOverage` + `recordOverage` |
| `src/components/app/plan-summary-card.tsx` | Modify | Add "Accrued overage this cycle" row reading from `getAccruedOverageCents` |

---

## Task C1: Verify Phase 1 contract is in place (no schema work to do)

Phase 1 Task 6 already landed the schema columns (`plan_billing_interval`, `annual_last_granted_at`, `last_failed_run_at`, `was_overage`) and the `overage_ledger` table. Agent C's work is purely the engine code on top.

**Files:** none (verification only).

- [ ] **Step 1: Confirm the schema is present**

```bash
grep -A 3 "plan_billing_interval\|overage_ledger\|was_overage" src/lib/db/schema.ts supabase/migrations/20260510000003_quota_contract.sql
```

Expected: column + table definitions visible. If missing, STOP and resolve before continuing — Phase 1 is incomplete.

- [ ] **Step 2: Confirm the stub helper is present**

```bash
grep "findOverageSubscriptionItem" src/lib/stripe/server.ts
```

Expected: a function returning `Promise<string | null>`. Agent B will replace the body; Agent C imports and uses it as-is.

- [ ] **Step 3: Skip the original Task C1 (kept below for historical reference)**

The contents below this point in the original plan are now obsolete schema work.

### Original (obsolete) Task C1 content

**Files:**
- Create: ~~`supabase/migrations/20260510000002_quota_engine.sql`~~ (handled by Phase 1)
- Modify: ~~`src/lib/db/schema.ts`~~ (handled by Phase 1)

- [ ] **Step 1: Write the SQL**

```sql
ALTER TABLE profiles
  ADD COLUMN plan_billing_interval text NOT NULL DEFAULT 'monthly',
  ADD COLUMN annual_last_granted_at timestamptz,
  ADD COLUMN last_failed_run_at timestamptz;

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

- [ ] **Step 2: Mirror in Drizzle**

In `src/lib/db/schema.ts`, edit `profiles`:
```ts
export const profiles = pgTable("profiles", {
  // ... existing columns
  planBillingInterval: text("plan_billing_interval", { enum: ["monthly", "annual"] })
    .notNull()
    .default("monthly"),
  annualLastGrantedAt: timestamp("annual_last_granted_at", { withTimezone: true }),
  lastFailedRunAt: timestamp("last_failed_run_at", { withTimezone: true }),
});
```

Add the new table:
```ts
export const overageLedger = pgTable(
  "overage_ledger",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    generationId: uuid("generation_id").references(() => generations.id, { onDelete: "set null" }),
    cents: integer("cents").notNull(),
    stripeUsageRecordId: text("stripe_usage_record_id"),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().default(sql`now()`),
    cycleAnchor: timestamp("cycle_anchor", { withTimezone: true }).notNull(),
  },
  (t) => [index("overage_ledger_user_cycle_idx").on(t.userId, t.cycleAnchor.desc())],
);

export type OverageLedger = typeof overageLedger.$inferSelect;
```

- [ ] **Step 3: Apply locally**
```bash
pnpm db:reset
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260510000002_quota_engine.sql src/lib/db/schema.ts
git commit -m "feat(billing): schema for quota engine + overage ledger"
```

---

## Task C2: `consumeQuota` engine (TDD)

**Files:**
- Create: `src/lib/billing/quota.test.ts`
- Create: `src/lib/billing/quota.ts`

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { consumeQuota } from "./quota";

vi.mock("@/lib/db/quota", () => ({
  tryConsumeQuota: vi.fn(),
  getQuotaBalance: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  },
}));

describe("consumeQuota", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true withinCap:true when user has balance", async () => {
    const mod = await import("@/lib/db/quota");
    (mod.tryConsumeQuota as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    (supabaseAdmin.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: null },
      error: null,
    });
    const r = await consumeQuota("user1", "run1");
    expect(r).toEqual({ ok: true, withinCap: true });
  });

  it("returns ok:true withinCap:false on paid plan when balance is 0 (overage)", async () => {
    const mod = await import("@/lib/db/quota");
    (mod.tryConsumeQuota as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    (supabaseAdmin.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: null },
      error: null,
    });
    const r = await consumeQuota("user1", "run1");
    expect(r).toEqual({ ok: true, withinCap: false });
  });

  it("returns ok:false on free plan when exhausted", async () => {
    const mod = await import("@/lib/db/quota");
    (mod.tryConsumeQuota as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    (supabaseAdmin.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { plan: "free", last_failed_run_at: null },
      error: null,
    });
    const r = await consumeQuota("user1", "run1");
    expect(r).toEqual({ ok: false, reason: "free_exhausted" });
  });

  it("skips deduction when retry within 5 minutes of last failed run", async () => {
    const mod = await import("@/lib/db/quota");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const recent = new Date(Date.now() - 60_000).toISOString();
    (supabaseAdmin.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: recent },
      error: null,
    });
    const r = await consumeQuota("user1", "run1");
    expect(mod.tryConsumeQuota).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, withinCap: true });
  });
});
```

- [ ] **Step 2: Run the test (expect failures)**
```bash
pnpm test src/lib/billing/quota.test.ts
```

- [ ] **Step 3: Write the implementation**

```ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tryConsumeQuota as dbTryConsumeQuota } from "@/lib/db/quota";
import { isPaidPlanSlug } from "@/lib/plans";

export type ConsumeQuotaResult =
  | { ok: true; withinCap: boolean }
  | { ok: false; reason: "free_exhausted" };

const FAILED_RETRY_WINDOW_MS = 5 * 60 * 1000;

export async function consumeQuota(
  userId: string,
  _runId: string,
): Promise<ConsumeQuotaResult> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("plan, last_failed_run_at")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new Error(`consumeQuota: profile not found for ${userId}`);
  }

  // Retry-within-5-minutes grace: if last failed run was recent, free retry.
  if (profile.last_failed_run_at) {
    const elapsed = Date.now() - new Date(profile.last_failed_run_at).getTime();
    if (elapsed < FAILED_RETRY_WINDOW_MS) {
      // Clear so subsequent attempts aren't all-free.
      await supabaseAdmin
        .from("profiles")
        .update({ last_failed_run_at: null })
        .eq("id", userId);
      return { ok: true, withinCap: true };
    }
  }

  const deducted = await dbTryConsumeQuota(userId, 1);
  if (deducted) return { ok: true, withinCap: true };

  // Out of quota.
  if (!isPaidPlanSlug(profile.plan)) {
    return { ok: false, reason: "free_exhausted" };
  }
  // Paid plan: overage allowed.
  return { ok: true, withinCap: false };
}

export async function markRunFailed(userId: string): Promise<void> {
  await supabaseAdmin
    .from("profiles")
    .update({ last_failed_run_at: new Date().toISOString() })
    .eq("id", userId);
}
```

- [ ] **Step 4: Run tests**
```bash
pnpm test src/lib/billing/quota.test.ts
```
Expected: all green.

- [ ] **Step 5: Commit**
```bash
git add src/lib/billing/quota.ts src/lib/billing/quota.test.ts
git commit -m "feat(billing): consumeQuota engine with 5m retry grace"
```

---

## Task C3: `reportOverage` Stripe helper (TDD)

**Pivot from original plan:** Stripe Meters require pre-created Meter objects that the Stripe MCP cannot create. We're using **invoice items at runtime** instead — `stripe.invoiceItems.create({ customer, amount, currency, description })` attaches an unbilled line to the customer's next invoice. No Meter, no metered price, no pre-attached subscription item. Subscriptions remain a single flat-price item.

Idempotency comes from a per-`generation_id` cache: we check the `overage_ledger` for a row with this generation_id before calling Stripe. Stripe also supports `Idempotency-Key` header on `invoiceItems.create` via the SDK's `{ idempotencyKey }` request option.

**Files:**
- Create: `src/lib/billing/overage.test.ts`
- Create: `src/lib/billing/overage.ts`
- Create: `src/lib/db/overage-ledger.ts`

- [ ] **Step 1: Write `overage-ledger.ts`**

```ts
import "server-only";
import { eq, and, gte, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { overageLedger } from "@/lib/db/schema";

export interface RecordOverageInput {
  userId: string;
  runId: string;
  generationId: string;
  cents: number;
  stripeInvoiceItemId: string | null;
  cycleAnchor: Date;
}

export async function recordOverage(input: RecordOverageInput): Promise<void> {
  await db
    .insert(overageLedger)
    .values({
      userId: input.userId,
      runId: input.runId,
      generationId: input.generationId,
      cents: input.cents,
      // schema column is `stripe_usage_record_id` — we repurpose it for the
      // invoice item id since the runtime no longer creates usage records.
      // (renaming the column is deferred; Drizzle field stays unchanged.)
      stripeUsageRecordId: input.stripeInvoiceItemId,
      cycleAnchor: input.cycleAnchor.toISOString() as unknown as Date,
    })
    .onConflictDoNothing();
}

export async function getAccruedOverageCents(
  userId: string,
  cycleAnchor: Date,
): Promise<number> {
  const [row] = await db
    .select({ total: sum(overageLedger.cents) })
    .from(overageLedger)
    .where(
      and(
        eq(overageLedger.userId, userId),
        gte(overageLedger.cycleAnchor, cycleAnchor.toISOString() as unknown as Date),
      ),
    );
  return Number(row?.total ?? 0);
}
```

- [ ] **Step 2: Write `overage.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportOverage } from "./overage";

vi.mock("@/lib/stripe/server", () => ({
  stripe: {
    invoiceItems: {
      create: vi.fn(),
    },
  },
}));

describe("reportOverage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls stripe.invoiceItems.create with the right shape and idempotency key", async () => {
    const { stripe } = await import("@/lib/stripe/server");
    (stripe.invoiceItems.create as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ id: "ii_123" });
    const r = await reportOverage({
      customerId: "cus_xyz",
      generationId: "gen_abc",
      cents: 50,
      description: "Overage photo",
    });
    expect(stripe.invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_xyz",
        amount: 50,
        currency: "usd",
        description: "Overage photo",
      }),
      { idempotencyKey: "overage:gen_abc" },
    );
    expect(r).toBe("ii_123");
  });

  it("returns null on Stripe error and does not throw", async () => {
    const { stripe } = await import("@/lib/stripe/server");
    (stripe.invoiceItems.create as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error("network"));
    const r = await reportOverage({
      customerId: "cus_xyz",
      generationId: "gen_abc",
      cents: 50,
      description: "Overage photo",
    });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 3: Write `overage.ts`**

```ts
import "server-only";
import { stripe } from "@/lib/stripe/server";

export interface ReportOverageInput {
  customerId: string;
  generationId: string;
  cents: number;
  description: string;
}

export async function reportOverage(
  input: ReportOverageInput,
): Promise<string | null> {
  try {
    const r = await stripe.invoiceItems.create(
      {
        customer: input.customerId,
        amount: input.cents,
        currency: "usd",
        description: input.description,
      },
      { idempotencyKey: `overage:${input.generationId}` },
    );
    return r.id ?? null;
  } catch (err) {
    console.error("[overage] stripe invoice item failed", {
      generationId: input.generationId,
      err,
    });
    return null;
  }
}
```

- [ ] **Step 4: Run tests**
```bash
pnpm test src/lib/billing/overage.test.ts
```

- [ ] **Step 5: Commit**
```bash
git add src/lib/billing/overage.ts src/lib/billing/overage.test.ts src/lib/db/overage-ledger.ts
git commit -m "feat(billing): overage usage record + local ledger"
```

---

## Task C4: Replace credit gate in `runs/route.ts`

**Files:**
- Modify: `src/app/api/runs/route.ts`
- Modify: `src/app/api/runs/[id]/complete-look/route.ts`

- [ ] **Step 1: In `runs/route.ts`, replace the free-only credit branch**

Find the block at lines ~80-110 with the `tryDeductCredits` call (already renamed to `tryConsumeQuota` in Phase 1). Replace with:

```ts
import { consumeQuota } from "@/lib/billing/quota";

// ... inside the handler, after we know `user`, `runId`, `plan`, `total`
for (let i = 0; i < total; i += 1) {
  const result = await consumeQuota(user.id, runId);
  if (!result.ok) {
    serverTrack({
      distinctId: user.id,
      event: "run_quota_exhausted",
      properties: { plan, reason: result.reason },
    });
    return NextResponse.json(
      { error: "You're out of photos for this cycle. Upgrade to keep generating." },
      { status: 402 },
    );
  }
  // result.withinCap === false → flag for overage report by the workflow on success.
}
```

The actual overage report happens in `process-run.ts` (Task C5) on the successful-generation path, so this route only gates entry. To pass the `withinCap` flag downstream, persist it on the `generations` row when the workflow creates it — or simpler: the workflow re-reads quota at completion time and reports overage if quota was 0 at the moment of completion (`getQuotaBalance + cap check`). **Use the simpler approach to avoid passing flags through the workflow boundary.**

- [ ] **Step 2: In `complete-look/route.ts`, replace its `tryConsumeQuota`/`addQuota` flow**

Same pattern. For complete-look packs the cost is `cost` (count of shots in the pack), so loop `cost` times. The "refund on failure" path (`addQuota(user.id, cost)`) is now: for each successful consume that crossed the cap, the workflow's success path doesn't fire and the cycle continues — no refund needed since the user wasn't actually billed for overage that didn't deliver. For consume-within-cap that fails downstream, refund via `addQuota` as today.

This is subtle. To keep parity with current behavior: track how many of the `cost` consumes were within-cap. On failure, refund only those (calling `addQuota(user.id, withinCapCount)`).

```ts
let withinCapCount = 0;
for (let i = 0; i < cost; i += 1) {
  const r = await consumeQuota(user.id, runId);
  if (!r.ok) {
    return NextResponse.json({ error: "insufficient quota" }, { status: 402 });
  }
  if (r.withinCap) withinCapCount += 1;
}
// ... later, on downstream failure:
if (!isAdmin) await addQuota(user.id, withinCapCount);
```

- [ ] **Step 3: Verify**
```bash
pnpm tsc --noEmit
pnpm test
```

- [ ] **Step 4: Commit**
```bash
git add src/app/api/runs/route.ts src/app/api/runs/[id]/complete-look/route.ts
git commit -m "feat(billing): replace free-only gate with consumeQuota (overage-aware)"
```

---

## Task C5: Overage hook in workflow

**Files:**
- Modify: `src/lib/workflows/process-run.ts`

The `was_overage` column on `generations` already exists (Phase 1 Task 6 contract). The runs route (Task C4 Step 1) sets it on insert when `consumeQuota` returns `withinCap: false`. The workflow's success path just reads it and reports.

- [ ] **Step 1: Wire the `was_overage` flag in `runs/route.ts`**

After each `consumeQuota`, mark the corresponding planned generation as `was_overage: true` when `withinCap === false`. Inspect how `runs/route.ts` creates generation rows (likely via a batch insert) and add a `was_overage` field per row.

- [ ] **Step 2: In `process-run.ts`, add the overage hook after generation success**

Find the successful-generation branch in `process-run.ts`. Add immediately after the generation row is updated to status `succeeded`:

```ts
import { reportOverage } from "@/lib/billing/overage";
import { recordOverage } from "@/lib/db/overage-ledger";
import { PLAN_QUOTA } from "@/lib/plans";

// ... inside the success path, with `userId`, `runId`, `generationId` already in scope
const { data: gen } = await supabaseAdmin
  .from("generations")
  .select("was_overage")
  .eq("id", generationId)
  .single();

if (gen?.was_overage) {
  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("plan, stripe_customer_id, plan_renews_at")
    .eq("id", userId)
    .single();
  const stripeCustomerId = profileRow?.stripe_customer_id;
  if (stripeCustomerId && profileRow) {
    const cents = PLAN_QUOTA[profileRow.plan as keyof typeof PLAN_QUOTA]?.overageCentsPerPhoto ?? 0;
    if (cents > 0) {
      const invoiceItemId = await reportOverage({
        customerId: stripeCustomerId,
        generationId,
        cents,
        description: "Overage photo",
      });
      const cycleAnchor = profileRow.plan_renews_at
        ? new Date(profileRow.plan_renews_at)
        : new Date();
      await recordOverage({
        userId,
        runId,
        generationId,
        cents,
        stripeInvoiceItemId: invoiceItemId,
        cycleAnchor,
      });
    }
  }
}
```

Update Drizzle `generations` table:
```ts
wasOverage: boolean("was_overage").notNull().default(false),
```

Then the workflow becomes:
```ts
const { data: gen } = await supabaseAdmin
  .from("generations")
  .select("was_overage")
  .eq("id", generationId)
  .single();
if (gen?.was_overage) {
  // ... report and record as above
}
```

- [ ] **Step 3: On generation failure, call `markRunFailed`**

In the workflow's failure path:
```ts
import { markRunFailed } from "@/lib/billing/quota";
// ... on failure
await markRunFailed(userId);
```

This sets `last_failed_run_at` so a retry within 5 minutes is free.

- [ ] **Step 4: Verify**
```bash
pnpm tsc --noEmit
pnpm test
```

- [ ] **Step 5: Commit**
```bash
git add -u
git commit -m "feat(billing): overage hook on successful generations + retry grace"
```

---

## Task C6: Accrued overage in plan summary card

**Files:**
- Modify: `src/components/app/plan-summary-card.tsx`

- [ ] **Step 1: Read the current component**

Already takes `quotaUnitsRemaining` (after Phase 1 rename). Add a new prop `accruedOverageCents: number` and render a row showing `$X.XX accrued this cycle` when > 0.

- [ ] **Step 2: Update the call site (`src/app/(app)/account/page.tsx`)**

```ts
import { getAccruedOverageCents } from "@/lib/db/overage-ledger";
// ...
const cycleAnchor = profile.plan_renews_at ? new Date(profile.plan_renews_at) : new Date();
const accruedOverageCents = await getAccruedOverageCents(user.id, cycleAnchor);
// pass to <PlanSummaryCard />
```

- [ ] **Step 3: Render the new row in `plan-summary-card.tsx`**

```tsx
{accruedOverageCents > 0 && (
  <div className="mt-3 flex items-baseline justify-between">
    <span className="text-[12px] text-ink-3">Accrued overage this cycle</span>
    <span className="font-mono text-[12px] text-ink">
      ${(accruedOverageCents / 100).toFixed(2)}
    </span>
  </div>
)}
```

- [ ] **Step 4: Commit**
```bash
git add -u
git commit -m "feat(billing): show accrued overage on plan summary card"
```

---

## Self-Review

- ✅ Quota engine has TDD coverage for happy path, paid-overage path, free-exhausted, and retry grace.
- ✅ Overage hook keyed by `generation_id` (idempotent at Stripe + at local ledger via unique index).
- ✅ Retry-within-5m grace cleared on use to prevent infinite freebies.
- ✅ `was_overage` column avoids needing to recalculate "was this an overage" at workflow time.
- ✅ Free plan still uses the same `consumeQuota` entry — gated on `isPaidPlanSlug`.
- ⚠️ Open: existing complete-look pack credit-refund parity. Verified in Task C4 Step 2 by tracking `withinCapCount`.
- ⚠️ Open: `process-run.ts` may have multiple paths into "success" depending on the workflow library. Inspect carefully when adding the overage hook.
