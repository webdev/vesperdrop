# Pricing v2 — Phase 3 Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to work through this plan task-by-task. Phase 3 is orchestrator-driven (not dispatched to a subagent) because step 5 mirrors Stripe products to live mode.

**Goal:** Rebase the four Phase 2 agents in the correct order, run a full end-to-end smoke against Stripe test mode, mirror the catalog to live mode, swap production env vars, deploy, and verify.

**Architecture:** Each agent worked in an isolated worktree branched from the same Phase 1 commit. Phase 3 rebases them onto `main` one at a time so each agent's changes are visible to the next. The end-to-end test exercises every code path that crosses an agent boundary (checkout → webhook → quota gate → workflow overage hook → ledger surface).

---

## Task P3.1: Rebase Agent A onto main

**Files:** Agent A's worktree (paths captured by the orchestrator when worktree was created).

- [ ] **Step 1: Bring Agent A's branch into main**

```bash
git fetch ./<agent-a-worktree>
git merge ./<agent-a-worktree>/HEAD --no-ff -m "merge: Agent A pricing UI"
```

If conflicts in `src/lib/plans.ts`: Agent A only touches `PLAN_MARKETING`; accept Agent A's version for that export.

- [ ] **Step 2: Build + typecheck**

```bash
pnpm tsc --noEmit
pnpm build
```

Expected: clean build. Pricing page renders with new layout.

- [ ] **Step 3: Manual UI smoke**

```bash
pnpm dev
```

Visit http://localhost:3000/pricing. Confirm hero copy, toggle works, all CTAs point to correct URLs.

---

## Task P3.2: Rebase Agent C onto main

- [ ] **Step 1: Merge**

```bash
git merge ./<agent-c-worktree>/HEAD --no-ff -m "merge: Agent C quota engine + overage"
```

Conflicts in `src/lib/plans.ts` (`PLAN_QUOTA`), `src/lib/db/schema.ts` (new columns), generation flow files. Resolve by taking Agent C's version of `PLAN_QUOTA` and schema additions, keep Agent A's `PLAN_MARKETING`.

- [ ] **Step 2: Apply migrations**

```bash
pnpm db:reset
```

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: green. Quota engine tests, webhook tests (still using credit-shaped fixtures from Phase 1), and overage tests all pass.

---

## Task P3.3: Rebase Agent D onto main

- [ ] **Step 1: Merge**

```bash
git merge ./<agent-d-worktree>/HEAD --no-ff -m "merge: Agent D contact form"
```

Agent D doesn't conflict with anything material — only new files.

- [ ] **Step 2: Smoke `/contact`**

```bash
pnpm dev
```

Submit a test form. Confirm a Slack message appears in the configured channel (or skip if `CONTACT_SLACK_WEBHOOK_URL` is unset locally — note for Phase 3 deployment).

---

## Task P3.4: Rebase Agent B onto main (last, because it depends on C's schema)

- [ ] **Step 1: Merge**

```bash
git merge ./<agent-b-worktree>/HEAD --no-ff -m "merge: Agent B Stripe money flow"
```

Conflicts in `src/lib/plans.ts` (`PLAN_STRIPE`) and Stripe files. Accept Agent B's version of `PLAN_STRIPE` and the new webhook/reconcile shapes.

Critical post-merge check: `src/lib/stripe/webhook.ts` must call `refillQuota` (not `refillCredits`), use `PLAN_MONTHLY_QUOTA` (not `PLAN_MONTHLY_CREDITS`), and read `annual_last_granted_at` if it needs to. The Phase 1 rename pass made the first two changes automatically; the third comes from Agent B's edits.

- [ ] **Step 2: Run the whole test suite**

```bash
pnpm test
pnpm tsc --noEmit
```

Expected: green.

---

## Task P3.5: End-to-end test against Stripe TEST mode

- [ ] **Step 1: Start local dev with Stripe webhook listener**

```bash
pnpm dev:all
```

- [ ] **Step 2: Sign up as a fresh test user and run through each flow**

For each scenario, observe the exact expected outcomes:

| Scenario | Expected |
|---|---|
| Visit `/pricing`, toggle to Annual, click "Start Pro" | Redirects through `/api/stripe/checkout?plan=pro&interval=annual` to a Stripe Checkout page showing $374.40/year |
| Complete the test payment (`4242 4242 4242 4242`) | Stripe sends `checkout.session.completed` + `invoice.payment_succeeded` (billing_reason: `subscription_create`) — webhook grants 75 photos, plan set to `pro`, `plan_billing_interval` set to `annual` |
| Generate 75 photos through the app | All succeed within cap. `getQuotaBalance` reaches 0 |
| Generate one more photo (76th) | Succeeds. `was_overage: true` on that generation row. `process-run.ts` reports a usage record to Stripe and inserts an `overage_ledger` row with cents=50 |
| Visit `/account` | `PlanSummaryCard` shows "Accrued overage this cycle: $0.50" |
| Trigger a deliberate generation failure (e.g. invalid input), then retry within 5 minutes | The retry does NOT consume quota. `last_failed_run_at` is cleared after the retry |
| Visit `/contact?source=pricing-agency`, submit the form | A Slack message arrives in the configured channel with the source tagged |
| Run the cron route manually (with the `CRON_SECRET` Bearer header) | For an annual sub whose `annual_last_granted_at` is null or >28 days old, a new monthly grant is applied |

- [ ] **Step 3: Inspect Stripe test dashboard for the test subscription**

Open the subscription in the Stripe dashboard. Confirm:
- Two subscription items: the flat annual price + the metered overage price.
- Usage records on the metered item show the overage we generated.
- The upcoming invoice preview shows the metered line for the overage.

---

## Task P3.6: Mirror Stripe products to LIVE mode

- [ ] **Step 1: Confirm Stripe MCP is in LIVE mode**

```
mcp__claude_ai_Stripe__get_stripe_account_info
```
Confirm `livemode: true`. STOP if it returns `livemode: false`.

- [ ] **Step 2: Create the same 4 products + 12 prices in live mode**

Repeat Phase 1 Task 6 Steps 2-3, but in live mode. Confirm each product with the user before creating.

- [ ] **Step 3: Add the live-mode price IDs to Vercel production env**

```bash
vercel env add STRIPE_STARTER_PRICE_ID_MONTHLY production
# (paste live-mode price_xxx when prompted)
# ... repeat for all 12
```

Also add `CONTACT_SLACK_WEBHOOK_URL` to production if not already present.

**Per user preference: never run `vercel env pull`.** The user can pull manually if they need the values locally.

- [ ] **Step 4: Archive the old live-mode products**

Find the four old VesperDrop products in live mode (the ones referenced by `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, etc, that exist before this work). Confirm with the user, then archive each.

---

## Task P3.7: Deploy

- [ ] **Step 1: Push main**

```bash
git push origin main
```

Vercel triggers a preview build. Wait for it to finish.

- [ ] **Step 2: Inspect the preview deployment**

Visit the preview URL. Smoke `/pricing`, `/contact`, and (signed in) `/account`. If anything looks wrong, fix on main and push.

- [ ] **Step 3: Promote to production**

```bash
vercel promote --yes <preview-deployment-url>
```

Or via the dashboard.

- [ ] **Step 4: Verify production**

Live `vesperdrop.com/pricing` shows the new layout. Live `/api/stripe/checkout?plan=pro&interval=monthly` redirects to a Stripe Checkout backed by the live-mode price ID.

- [ ] **Step 5: Set the Stripe webhook endpoint to point at production**

In Stripe dashboard (live mode): webhook endpoints → verify that the existing endpoint URL is `https://vesperdrop.com/api/stripe/webhook` (or wherever). If not, update it. Verify the signing secret matches `STRIPE_WEBHOOK_SECRET` in production env.

---

## Task P3.8: Cleanup

- [ ] **Step 1: Remove old env var declarations**

In `src/lib/env.ts`, remove `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, `STRIPE_STUDIO_PRICE_ID`, `STRIPE_AGENCY_PRICE_ID`. Run `pnpm tsc --noEmit`; fix any compile breaks (there shouldn't be any since Phase 1's rename pass eliminated all consumers).

```bash
vercel env rm STRIPE_PRO_PRICE_ID production preview development
vercel env rm STRIPE_STARTER_PRICE_ID production preview development
vercel env rm STRIPE_STUDIO_PRICE_ID production preview development
vercel env rm STRIPE_AGENCY_PRICE_ID production preview development
```

Confirm each removal with the user before pressing through.

- [ ] **Step 2: Commit**

```bash
git add src/lib/env.ts
git commit -m "chore(env): remove legacy STRIPE_*_PRICE_ID vars"
git push origin main
```

---

## Self-Review

- ✅ Rebase order (A → C → D → B) chosen so each agent's changes compile before the next is merged.
- ✅ End-to-end test exercises every cross-agent path (checkout → webhook → quota → workflow → overage → ledger → UI).
- ✅ Live-mode mirroring is its own task with explicit `livemode: true` check.
- ✅ Legacy env cleanup is the last commit so a rollback in steps 6-7 doesn't need to restore them.
- ⚠️ Open: webhook signing secret. `STRIPE_WEBHOOK_SECRET` should be unchanged across this work but verify in Task P3.7 Step 5.
