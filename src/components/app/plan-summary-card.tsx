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
