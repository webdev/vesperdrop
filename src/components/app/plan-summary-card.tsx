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
              Credits
            </p>
            <p className="mt-3 font-serif text-[clamp(2.25rem,3.5vw,3rem)] leading-none tracking-[-0.02em] tabular-nums text-ink">
              {creditsRemaining.toLocaleString()}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
              {creditsRemaining === 1 ? "credit remaining" : "credits remaining"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {stripeCustomerId ? (
            <Link
              href="/api/stripe/portal"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
            >
              Manage subscription
            </Link>
          ) : isFree ? (
            <a
              href="/api/stripe/checkout?plan=pro"
              className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
            >
              Upgrade to Pro <span aria-hidden>→</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
