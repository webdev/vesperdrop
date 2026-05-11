"use client";
import type { PaidPlanSlug, PlanMarketing, PlanQuota } from "@/lib/plans";
import { track } from "@/lib/analytics";
import { useBilling } from "./billing-provider";
import { formatEffectiveMonthly } from "./hero-pair";

export interface ComparisonRow {
  slug: PaidPlanSlug;
  marketing: PlanMarketing;
  quota: PlanQuota;
}

export function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  const { interval } = useBilling();
  const header =
    interval === "annual" ? "All plans, annual billing" : "All plans, monthly billing";

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="border-b border-line-soft bg-paper-soft px-6 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          {header}
        </p>
      </div>
      <div className="divide-y divide-line-soft">
        {rows.map(({ slug, marketing: m, quota: q }) => {
          const isContact = m.ctaTarget === "contact";
          const href = isContact
            ? `/contact?source=pricing-${slug}`
            : `/api/stripe/checkout?plan=${slug}&interval=${interval}`;
          const perPhoto =
            interval === "annual" ? m.perPhotoAnnualDisplay : m.perPhotoMonthlyDisplay;
          const onTrack = () => {
            if (!isContact) {
              track("pricing_plan_clicked", { plan: slug, billing: interval });
            }
          };
          return (
            <a
              key={slug}
              href={href}
              onClick={onTrack}
              className={
                "grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-5 transition-colors hover:bg-paper-soft/40 sm:grid-cols-[160px_1fr_120px_120px_140px] " +
                (m.badge === "popular" ? "bg-paper-soft/60" : "")
              }
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">{m.label}</span>
                {m.badge === "popular" && (
                  <span className="inline-flex items-center rounded-full bg-terracotta px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cream">
                    Popular
                  </span>
                )}
                {m.badge === "for-agencies" && (
                  <span className="inline-flex items-center rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cream">
                    For agencies
                  </span>
                )}
              </div>
              <div className="hidden text-[14px] text-ink-3 sm:block">
                {q.monthlyQuota.toLocaleString()} photos / mo
              </div>
              <div className="hidden font-mono text-[11px] uppercase tracking-[0.08em] text-ink-4 sm:block">
                {perPhoto}
              </div>
              <div className="text-right font-medium text-ink sm:text-left">
                {formatEffectiveMonthly(slug, interval)}
                <span className="text-[12px] font-normal text-ink-3">/mo</span>
              </div>
              <div className="hidden justify-end sm:flex">
                <span
                  aria-hidden
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink"
                >
                  {m.ctaLabel}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
