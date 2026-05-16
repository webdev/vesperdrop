"use client";
import Link from "next/link";
import type { PlanMarketing, PlanSlug } from "@/lib/plans";
import { track } from "@/lib/analytics";
import { useBilling } from "./billing-provider";

const FLAT_MONTHLY_USD: Record<PlanSlug, number> = {
  free: 0,
  starter: 19,
  pro: 39,
  studio: 99,
  agency: 499,
};

export function formatEffectiveMonthly(
  slug: PlanSlug,
  interval: "monthly" | "annual",
): string {
  const m = FLAT_MONTHLY_USD[slug];
  if (m === 0) return "$0";
  const v = interval === "annual" ? m * 0.8 : m;
  return v % 1 === 0 ? `$${v}` : `$${v.toFixed(2)}`;
}

export function formatAnnualTotal(slug: PlanSlug): string {
  const m = FLAT_MONTHLY_USD[slug];
  const yr = m * 12 * 0.8;
  return yr % 1 === 0 ? `$${yr.toFixed(0)}` : `$${yr.toFixed(2)}`;
}

export function HeroPair({
  free,
  pro,
}: {
  free: PlanMarketing;
  pro: PlanMarketing;
}) {
  const { interval } = useBilling();
  const proPerPhoto =
    interval === "annual" ? pro.perPhotoAnnualDisplay : pro.perPhotoMonthlyDisplay;

  return (
    <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
      {/* Free */}
      <div className="flex flex-col rounded-xl border border-line bg-surface p-8 md:p-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          {free.label}
        </p>
        <div className="mb-1 mt-5 flex items-baseline gap-1.5">
          <span className="font-serif text-[clamp(2.75rem,4vw,3.5rem)] leading-none tracking-[-0.02em] text-ink">
            $0
          </span>
          <span className="text-[14px] text-ink-3">/month</span>
        </div>
        <p className="mt-3 text-[14px] leading-[1.55] text-ink-3">{free.description}</p>
        <ul className="mt-7 space-y-3 text-[14px] text-ink-2">
          {free.features.map((f) => (
            <Feature key={f}>{f}</Feature>
          ))}
        </ul>
        <Link
          href="/try"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
        >
          {free.ctaLabel}
        </Link>
      </div>

      {/* Pro */}
      <div className="relative flex flex-col rounded-xl border border-ink bg-ink p-8 text-cream md:p-10">
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center rounded-full bg-terracotta px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream">
          Most popular
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cream/55">
          {pro.label}
        </p>
        <div className="mb-1 mt-5 flex items-baseline gap-1.5">
          <span className="font-serif text-[clamp(2.75rem,4vw,3.5rem)] leading-none tracking-[-0.02em]">
            {formatEffectiveMonthly("pro", interval)}
          </span>
          <span className="text-[14px] text-cream/55">/month</span>
        </div>
        {interval === "annual" && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/55">
            Billed annually at {formatAnnualTotal("pro")}
          </p>
        )}
        <p className="mt-3 text-[14px] leading-[1.55] text-cream/70">{pro.description}</p>
        <ul className="mt-7 space-y-3 text-[14px] text-cream/85">
          {pro.features.map((f) => (
            <Feature key={f} dark>{f}</Feature>
          ))}
        </ul>
        <a
          href={`/api/stripe/checkout?plan=pro&interval=${interval}`}
          onClick={() => {
            track("pricing_plan_clicked", { plan: "pro", billing: interval });
            track("checkout_started", {
              kind: "subscription",
              plan: "pro",
              interval: interval === "annual" ? "annual" : "monthly",
              location: "hero",
            });
          }}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
        >
          {pro.ctaLabel} <span aria-hidden>→</span>
        </a>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-cream/55">
          {pro.perPhotoMonthlyDisplay}, {pro.overageDisplay}
        </p>
      </div>
    </div>
  );
}

function Feature({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        className={dark ? "mt-0.5 shrink-0 text-terracotta-soft" : "mt-0.5 shrink-0 text-terracotta"}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
