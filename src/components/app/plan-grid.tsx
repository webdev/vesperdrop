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
        const isRecommended = Boolean(tier.recommended);
        const cta = ctaFor({ tier, isFree, isCurrent });
        const isDark = isRecommended;

        return (
          <div
            key={tier.slug}
            className={`relative flex flex-col rounded-xl border p-6 ${
              isDark
                ? "border-ink bg-ink text-cream"
                : "border-line bg-surface text-ink"
            }`}
          >
            {isRecommended ? (
              <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-terracotta px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream">
                Most popular
              </span>
            ) : null}

            <p
              className={`font-mono text-[11px] uppercase tracking-[0.12em] ${
                isDark ? "text-cream/60" : "text-ink-3"
              }`}
            >
              {tier.label}
            </p>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span
                className={`font-serif text-[clamp(2.25rem,3vw,2.75rem)] leading-none tracking-[-0.02em] ${
                  isDark ? "text-cream" : "text-ink"
                }`}
              >
                ${tier.price}
              </span>
              <span
                className={`text-[14px] ${isDark ? "text-cream/55" : "text-ink-3"}`}
              >
                /mo
              </span>
            </div>

            <p
              className={`mt-2 font-mono text-[11px] uppercase tracking-[0.08em] ${
                isDark ? "text-cream/55" : "text-ink-4"
              }`}
            >
              {tier.credits.toLocaleString()} credits · {tier.perCredit}/credit
            </p>

            <ul
              className={`mt-6 space-y-2.5 text-[14px] ${
                isDark ? "text-cream/85" : "text-ink-2"
              }`}
            >
              {tier.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <svg
                    className={`mt-0.5 shrink-0 ${
                      isDark ? "text-terracotta-soft" : "text-terracotta"
                    }`}
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
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7">{cta}</div>
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
  const isDark = Boolean(tier.recommended);

  if (isCurrent) {
    return (
      <span
        className={`inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] ${
          isDark
            ? "bg-cream/10 text-cream/85"
            : "border border-line bg-paper-soft text-ink-3"
        }`}
      >
        Current plan
      </span>
    );
  }

  if (isFree) {
    if (isDark) {
      return (
        <a
          href={`/api/stripe/checkout?plan=${tier.slug}`}
          onClick={() =>
            track("plan_choose_clicked", { plan: tier.slug, location: "account" })
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-terracotta px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
        >
          Choose {tier.label} <span aria-hidden>→</span>
        </a>
      );
    }
    return (
      <a
        href={`/api/stripe/checkout?plan=${tier.slug}`}
        onClick={() =>
          track("plan_choose_clicked", { plan: tier.slug, location: "account" })
        }
        className="inline-flex w-full items-center justify-center rounded-full border border-line bg-paper-soft px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
      >
        Choose {tier.label}
      </a>
    );
  }

  if (isDark) {
    return (
      <a
        href={`/api/stripe/portal?to=${tier.slug}`}
        onClick={() =>
          track("plan_switch_clicked", { plan: tier.slug, location: "account" })
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-terracotta px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
      >
        Switch to {tier.label} <span aria-hidden>→</span>
      </a>
    );
  }
  return (
    <a
      href={`/api/stripe/portal?to=${tier.slug}`}
      onClick={() =>
        track("plan_switch_clicked", { plan: tier.slug, location: "account" })
      }
      className="inline-flex w-full items-center justify-center rounded-full border border-line bg-paper-soft px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
    >
      Switch to {tier.label}
    </a>
  );
}
