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
            className={`relative flex flex-col rounded-2xl border p-6 ${
              isDark
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-900"
            }`}
          >
            {isRecommended ? (
              <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-white uppercase">
                Most popular
              </span>
            ) : null}

            <p
              className={`text-[11px] font-medium tracking-[0.2em] uppercase ${
                isDark ? "text-zinc-400" : "text-zinc-500"
              }`}
            >
              {tier.label}
            </p>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span
                className={`text-[40px] font-semibold tracking-tight ${
                  isDark ? "text-white" : "text-zinc-900"
                }`}
              >
                ${tier.price}
              </span>
              <span
                className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
              >
                /mo
              </span>
            </div>

            <p
              className={`mt-1 text-[12px] ${
                isDark ? "text-zinc-400" : "text-zinc-500"
              }`}
            >
              {tier.credits.toLocaleString()} credits · {tier.perCredit}/credit
            </p>

            <ul
              className={`mt-5 space-y-2.5 text-[14px] ${
                isDark ? "text-zinc-200" : "text-zinc-700"
              }`}
            >
              {tier.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <svg
                    className={`mt-0.5 shrink-0 ${
                      isDark ? "text-orange-400" : "text-orange-500"
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

            <div className="mt-6">{cta}</div>
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
        className={`inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium ${
          isDark
            ? "bg-white/10 text-zinc-200"
            : "border border-zinc-200 bg-zinc-50 text-zinc-500"
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
          onClick={() => track("plan_choose_clicked", { plan: tier.slug, location: "account" })}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-transform hover:scale-[1.02]"
        >
          Choose {tier.label} <span aria-hidden>→</span>
        </a>
      );
    }
    return (
      <a
        href={`/api/stripe/checkout?plan=${tier.slug}`}
        onClick={() => track("plan_choose_clicked", { plan: tier.slug, location: "account" })}
        className="inline-flex w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
      >
        Choose {tier.label}
      </a>
    );
  }

  if (isDark) {
    return (
      <a
        href={`/api/stripe/portal?to=${tier.slug}`}
        onClick={() => track("plan_switch_clicked", { plan: tier.slug, location: "account" })}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-transform hover:scale-[1.02]"
      >
        Switch to {tier.label} <span aria-hidden>→</span>
      </a>
    );
  }
  return (
    <a
      href={`/api/stripe/portal?to=${tier.slug}`}
      onClick={() => track("plan_switch_clicked", { plan: tier.slug, location: "account" })}
      className="inline-flex w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
      Switch to {tier.label}
    </a>
  );
}
