# Pricing v2 — Plan Manifest

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each child plan task-by-task.

**Spec:** `docs/superpowers/specs/2026-05-10-pricing-v2-design.md`

**Goal:** Move VesperDrop to a photo-based subscription model with four tiers, monthly/annual toggle, metered overage past cap, and a contact-sales flow.

## Build order

| # | Plan | Owner | Depends on |
|---|---|---|---|
| 1 | [`2026-05-10-pricing-v2-phase1-prep.md`](./2026-05-10-pricing-v2-phase1-prep.md) | Orchestrator (me, with user confirmation) | — |
| 2 | [`2026-05-10-pricing-v2-agent-a-pricing-ui.md`](./2026-05-10-pricing-v2-agent-a-pricing-ui.md) | Agent A | Phase 1 (catalog file split, plan slug list unchanged) |
| 3 | [`2026-05-10-pricing-v2-agent-b-stripe.md`](./2026-05-10-pricing-v2-agent-b-stripe.md) | Agent B | Phase 1 (Stripe price IDs in env, schema rename) |
| 4 | [`2026-05-10-pricing-v2-agent-c-quota-overage.md`](./2026-05-10-pricing-v2-agent-c-quota-overage.md) | Agent C | Phase 1 (schema rename complete) |
| 5 | [`2026-05-10-pricing-v2-agent-d-contact.md`](./2026-05-10-pricing-v2-agent-d-contact.md) | Agent D | — (only consumes `CONTACT_SLACK_WEBHOOK_URL` env var) |
| 6 | [`2026-05-10-pricing-v2-phase3-integration.md`](./2026-05-10-pricing-v2-phase3-integration.md) | Orchestrator | All Phase 2 agents complete |

## Hand-off rule

`src/lib/plans.ts` is split into three exports so Phase 2 agents don't conflict:

- `PLAN_MARKETING` — Agent A only
- `PLAN_STRIPE` — Agent B only
- `PLAN_QUOTA` — Agent C only

Phase 1 lands the new file shape (with all three exports present but containing placeholder values where the owning agent will fill in). Agents then fill in their export and only their export.

## Cross-agent contract (landed by Phase 1)

Phase 2 has one cyclic dependency (Agent C uses a Stripe helper Agent B defines; Agent B's cron reads schema columns Agent C would add). Phase 1 Task 6 resolves this by landing both ends as the contract:

- Schema: `profiles.plan_billing_interval`, `profiles.annual_last_granted_at`, `profiles.last_failed_run_at`, `generations.was_overage`, plus the `overage_ledger` table.
- Stub helper: `findOverageSubscriptionItem` in `src/lib/stripe/server.ts` returning `null`.

This means each Phase 2 agent's worktree compiles independently against Phase 1's state.

## Rebase order in Phase 3

A → C → D → B. Each merge resolves into a working tree because the contract is already in place. B is last so its real `findOverageSubscriptionItem` replaces the stub after the rest of the integration is verified.
