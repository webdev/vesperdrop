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
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-10">
          <div>
            <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
              Current plan
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
              {record.label}
            </p>
            {renewsAt ? (
              <p className="mt-1 text-sm text-zinc-500">
                {cancelAtPeriodEnd ? "Cancels" : "Renews"} {renewsAt.toLocaleDateString()}
              </p>
            ) : isFree ? (
              <p className="mt-1 text-sm text-zinc-500">No active subscription</p>
            ) : null}
            {cancelAtPeriodEnd ? (
              <span className="mt-3 inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-zinc-600 uppercase">
                Scheduled to cancel
              </span>
            ) : null}
          </div>

          <div className="md:border-l md:border-zinc-200 md:pl-10">
            <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
              Credits
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900 tabular-nums">
              {creditsRemaining.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {creditsRemaining === 1 ? "credit remaining" : "credits remaining"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {stripeCustomerId ? (
            <Link
              href="/api/stripe/portal"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              Manage subscription
            </Link>
          ) : isFree ? (
            <a
              href="/api/stripe/checkout?plan=pro"
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              Upgrade to Pro <span aria-hidden>→</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
