-- Pricing v2 cross-agent contract.
-- Lands schema columns + a stub Stripe helper so Phase 2 agents (B Stripe
-- money flow, C quota engine + overage) can work in isolated worktrees
-- without depending on each other's commits.

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

-- One overage record per (user, generation). Prevents double-billing on
-- workflow retries that re-enter the overage hook for the same generation.
CREATE UNIQUE INDEX overage_ledger_user_generation_unique_idx
  ON overage_ledger (user_id, generation_id)
  WHERE generation_id IS NOT NULL;
