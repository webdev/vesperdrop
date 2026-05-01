"use client";

import type { PlanRecord, PlanSlug } from "@/lib/plans";
import { track } from "@/lib/analytics";

interface Props {
  tiers: PlanRecord[];
  currentPlan: PlanSlug;
}

export function PlanGrid({ tiers, currentPlan }: Props) {
  const isFree = currentPlan === "free";
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {tiers.map((tier) => {
        const isCurrent = tier.slug === currentPlan;
        const cta = ctaFor({ tier, isFree, isCurrent });
        return (
          <div
            key={tier.slug}
            className={`relative flex flex-col rounded-xl border p-5 ${
              tier.recommended
                ? "border-[var(--color-ink)] bg-[var(--color-paper-2)]"
                : "border-[var(--color-line)] bg-[var(--color-cream)]"
            }`}
          >
            {tier.recommended ? (
              <span className="absolute -top-2 left-4 rounded-full bg-[var(--color-ember)] px-2 py-0.5 font-mono text-[9px] tracking-[0.14em] text-[var(--color-cream)]">
                MOST POPULAR
              </span>
            ) : null}
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
              {tier.label}
            </p>
            <p className="mt-3 font-serif text-3xl">
              ${tier.price}
              <span className="text-sm text-[var(--color-ink-3)]">/mo</span>
            </p>
            <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-[var(--color-ink-3)]">
              {tier.credits.toLocaleString()} CREDITS · {tier.perCredit}/CREDIT
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--color-ink-2)]">
              {tier.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--color-ink-3)]" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-5">{cta}</div>
          </div>
        );
      })}
    </div>
  );
}

function ctaFor({
  tier,
  isFree,
  isCurrent,
}: {
  tier: PlanRecord;
  isFree: boolean;
  isCurrent: boolean;
}) {
  if (isCurrent) {
    return (
      <span className="inline-flex w-full justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-paper-2)] px-4 py-2 text-sm text-[var(--color-ink-3)]">
        Current plan
      </span>
    );
  }
  if (isFree) {
    return (
      <a
        href={`/api/stripe/checkout?plan=${tier.slug}`}
        onClick={() => track("plan_choose_clicked", { plan: tier.slug, location: "account" })}
        className="inline-flex w-full justify-center rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-cream)] hover:bg-[var(--color-ink-2)]"
      >
        Choose {tier.label}
      </a>
    );
  }
  return (
    <a
      href={`/api/stripe/portal?to=${tier.slug}`}
      onClick={() => track("plan_switch_clicked", { plan: tier.slug, location: "account" })}
      className="inline-flex w-full justify-center rounded-full border border-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[var(--color-cream)]"
    >
      Switch to {tier.label}
    </a>
  );
}
