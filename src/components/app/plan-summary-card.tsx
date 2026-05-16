import "server-only";
import { stripe } from "@/lib/stripe/server";
import { PLAN_CATALOG, type PlanSlug } from "@/lib/plans";
import { PlanSummaryActions } from "./plan-summary-actions";

interface Props {
  plan: PlanSlug;
  quotaUnitsRemaining: number;
  stripeCustomerId: string | null;
  fallbackRenewsAt: string | null;
  accruedOverageCents?: number;
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
  quotaUnitsRemaining,
  stripeCustomerId,
  fallbackRenewsAt,
  accruedOverageCents = 0,
}: Props) {
  const record = PLAN_CATALOG[plan];
  const live = await fetchLiveSubState(stripeCustomerId);
  const renewsAtIso = live?.renewsAt ?? fallbackRenewsAt;
  const renewsAt = renewsAtIso ? new Date(renewsAtIso) : null;
  const cancelAtPeriodEnd = live?.cancelAtPeriodEnd ?? false;
  const isFree = plan === "free";

  return (
    <div className="rounded-xl border border-line bg-surface p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              Current plan
            </p>
            <p className="mt-3 font-serif text-[clamp(1.625rem,2.2vw,2rem)] leading-[1.1] tracking-[-0.01em] text-ink">
              {record.label}
            </p>
            {renewsAt ? (
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
                {cancelAtPeriodEnd ? "Cancels" : "Renews"}{" "}
                {renewsAt.toLocaleDateString()}
              </p>
            ) : isFree ? (
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
                No active subscription
              </p>
            ) : null}
            {cancelAtPeriodEnd ? (
              <span className="mt-3 inline-flex items-center rounded-full border border-line bg-paper-2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
                Scheduled to cancel
              </span>
            ) : null}
          </div>

          <div className="md:border-l md:border-line-soft md:pl-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              Photos
            </p>
            <p className="mt-3 font-serif text-[clamp(2.25rem,3.5vw,3rem)] leading-none tracking-[-0.02em] tabular-nums text-ink">
              {quotaUnitsRemaining.toLocaleString()}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
              {quotaUnitsRemaining === 1 ? "photo remaining" : "photos remaining"}
            </p>
            {accruedOverageCents > 0 && (
              <div className="mt-3 flex items-baseline justify-between gap-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                  Accrued overage this cycle
                </span>
                <span className="font-mono text-[12px] tabular-nums text-ink">
                  ${(accruedOverageCents / 100).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <PlanSummaryActions
            hasStripeCustomer={Boolean(stripeCustomerId)}
            isFree={isFree}
          />
        </div>
      </div>
    </div>
  );
}
