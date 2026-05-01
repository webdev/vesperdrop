"use client";
import Link from "next/link";
import { track } from "@/lib/analytics";
import type { PlanRecord } from "@/lib/plans";

interface Tier extends PlanRecord {
  id: string;
  cta: string;
  href: string;
}

function toTier(record: PlanRecord): Tier {
  return {
    ...record,
    id: record.slug,
    cta: `Start ${record.label}`,
    href: `/api/stripe/checkout?plan=${record.slug}`,
  };
}

const ONE_TIME_PACKS = [
  { credits: 10, price: 9, perCredit: "90¢" },
  { credits: 25, price: 19, perCredit: "76¢" },
  { credits: 100, price: 59, perCredit: "59¢" },
];

export function PricingCards({ tiers: tierRecords }: { tiers: PlanRecord[] }) {
  const tiers = tierRecords.map(toTier);
  const proTier = tiers.find((t) => t.slug === "pro");

  return (
    <div className="mx-auto max-w-5xl px-6 pt-2 pb-20 md:px-10">
      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col rounded-[20px] border border-zinc-200 bg-white p-7 md:p-8">
          <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
            Free
          </p>
          <div className="mt-4 mb-1 flex items-baseline gap-1.5">
            <span className="text-[48px] font-semibold tracking-tight text-zinc-900">
              $0
            </span>
            <span className="text-sm text-zinc-500">/month</span>
          </div>
          <p className="mt-2 text-[14px] leading-[1.55] text-zinc-600">
            Try Vesperdrop. No card required.
          </p>
          <ul className="mt-6 space-y-3 text-[14px] text-zinc-700">
            <Feature>1 full-resolution HD generation</Feature>
            <Feature>5 watermarked 720p previews</Feature>
            <Feature>All scene presets</Feature>
            <Feature>Email support</Feature>
          </ul>
          <Link
            href="/try"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-6 py-3.5 text-[14px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            Try free — no account needed
          </Link>
        </div>

        <div className="relative flex flex-col rounded-[20px] border border-zinc-900 bg-zinc-900 p-7 text-white md:p-8">
          <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-white uppercase">
            Most popular
          </span>
          <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-400 uppercase">
            Pro
          </p>
          <div className="mt-4 mb-1 flex items-baseline gap-1.5">
            <span className="text-[48px] font-semibold tracking-tight text-white">
              ${proTier?.price ?? 49}
            </span>
            <span className="text-sm text-zinc-400">/month</span>
          </div>
          <p className="mt-2 text-[14px] leading-[1.55] text-zinc-300">
            For sellers refreshing 30–100 SKUs/quarter. 200 credits covers it
            comfortably.
          </p>
          <ul className="mt-6 space-y-3 text-[14px] text-zinc-200">
            <Feature dark>200 credits / month</Feature>
            <Feature dark>Full resolution, no watermark</Feature>
            <Feature dark>All scene presets + custom prompts</Feature>
            <Feature dark>Priority generation queue</Feature>
            <Feature dark>Cancel any time</Feature>
          </ul>
          <a
            href="/api/stripe/checkout?plan=pro"
            onClick={() =>
              track("pricing_plan_clicked", { plan: "pro", billing: "monthly" })
            }
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] font-medium text-zinc-900 transition-transform hover:scale-[1.02]"
          >
            Start Pro <span aria-hidden>→</span>
          </a>
          <p className="mt-3 text-center text-[11px] tracking-wide text-zinc-400">
            25¢ per credit · cancel any time
          </p>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-[20px] border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-4">
          <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
            All plans · credits never expire within your billing period
          </p>
        </div>
        <div className="divide-y divide-zinc-200">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-5 sm:grid-cols-[160px_1fr_88px_100px_140px] ${
                tier.recommended ? "bg-zinc-50/70" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900">{tier.label}</span>
                {tier.recommended && (
                  <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-white uppercase">
                    Popular
                  </span>
                )}
              </div>
              <div className="hidden text-[14px] text-zinc-500 sm:block">
                {tier.credits.toLocaleString()} credits / mo
              </div>
              <div className="hidden text-[12px] text-zinc-500 sm:block">
                {tier.perCredit} / credit
              </div>
              <div className="text-right font-medium text-zinc-900 sm:text-left">
                ${tier.price}
                <span className="text-xs font-normal text-zinc-500">/mo</span>
              </div>
              <div className="hidden justify-end sm:flex">
                <a
                  href={tier.href}
                  onClick={() =>
                    track("pricing_plan_clicked", {
                      plan: tier.id,
                      billing: "monthly",
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  {tier.cta}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-10 rounded-[20px] border border-dashed border-zinc-300 bg-zinc-50/60 p-7">
        <div className="mb-5">
          <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
            One-time packs · no subscription
          </p>
          <p className="mt-1 text-[14px] text-zinc-600">
            Not ready to subscribe? Buy credits once. They don&rsquo;t expire.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ONE_TIME_PACKS.map((pack) => (
            <a
              key={pack.credits}
              href={`/api/stripe/checkout?plan=pack-${pack.credits}`}
              onClick={() =>
                track("pricing_pack_clicked", { credits: pack.credits })
              }
              className="flex items-center justify-between rounded-[14px] border border-zinc-200 bg-white px-4 py-3.5 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              <div>
                <span className="font-medium text-zinc-900">
                  {pack.credits} credits
                </span>
                <span className="ml-2 text-[11px] text-zinc-500">
                  {pack.perCredit}/credit
                </span>
              </div>
              <span className="font-medium text-zinc-900">${pack.price}</span>
            </a>
          ))}
        </div>
        <p className="mt-4 text-[11px] tracking-wide text-zinc-500">
          Subscribers pay less per credit — packs are the on-ramp to a plan.
        </p>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-[20px] border border-dashed border-zinc-300 px-6 py-5 sm:flex-row">
        <div>
          <p className="text-[14px] font-medium text-zinc-900">Billing by Stripe</p>
          <p className="text-[12px] text-zinc-500">
            Manage or cancel any time from your account. Prices in USD.
          </p>
        </div>
        <p className="text-[11px] tracking-[0.2em] text-zinc-500 uppercase">
          Secure · cancel any time · no hidden fees
        </p>
      </div>
    </div>
  );
}

function Feature({
  children,
  dark,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        className={
          dark ? "mt-0.5 shrink-0 text-orange-400" : "mt-0.5 shrink-0 text-emerald-600"
        }
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
