"use client";
import Link from "next/link";
import { Container } from "@/components/ui/container";
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
    <Container width="marketing" className="pb-24 pt-2">
      {/* Free vs Pro — Pro is the dominant solid card per CLAUDE.md */}
      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-line bg-surface p-8 md:p-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Free
          </p>
          <div className="mb-1 mt-5 flex items-baseline gap-1.5">
            <span className="font-serif text-[clamp(2.75rem,4vw,3.5rem)] leading-none tracking-[-0.02em] text-ink">
              $0
            </span>
            <span className="text-[14px] text-ink-3">/month</span>
          </div>
          <p className="mt-3 text-[14px] leading-[1.55] text-ink-3">
            Try Vesperdrop. No card required.
          </p>
          <ul className="mt-7 space-y-3 text-[14px] text-ink-2">
            <Feature>1 full-resolution HD generation</Feature>
            <Feature>5 watermarked 720p previews</Feature>
            <Feature>All scene presets</Feature>
            <Feature>Email support</Feature>
          </ul>
          <Link
            href="/try"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
          >
            Try free — no account needed
          </Link>
        </div>

        <div className="relative flex flex-col rounded-xl border border-ink bg-ink p-8 text-cream md:p-10">
          <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center rounded-full bg-terracotta px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream">
            Most popular
          </span>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cream/55">
            Pro
          </p>
          <div className="mb-1 mt-5 flex items-baseline gap-1.5">
            <span className="font-serif text-[clamp(2.75rem,4vw,3.5rem)] leading-none tracking-[-0.02em]">
              ${proTier?.price ?? 49}
            </span>
            <span className="text-[14px] text-cream/55">/month</span>
          </div>
          <p className="mt-3 text-[14px] leading-[1.55] text-cream/70">
            For sellers refreshing 30–100 SKUs/quarter. 200 credits covers it
            comfortably.
          </p>
          <ul className="mt-7 space-y-3 text-[14px] text-cream/85">
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
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
          >
            Start Pro <span aria-hidden>→</span>
          </a>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-cream/55">
            25¢ per credit · cancel any time
          </p>
        </div>
      </div>

      {/* All tiers */}
      <div className="mb-6 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line-soft bg-paper-soft px-6 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            All plans · credits never expire within your billing period
          </p>
        </div>
        <div className="divide-y divide-line-soft">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-5 sm:grid-cols-[160px_1fr_88px_100px_140px] ${
                tier.recommended ? "bg-paper-soft/60" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">{tier.label}</span>
                {tier.recommended && (
                  <span className="inline-flex items-center rounded-full bg-terracotta px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cream">
                    Popular
                  </span>
                )}
              </div>
              <div className="hidden text-[14px] text-ink-3 sm:block">
                {tier.credits.toLocaleString()} credits / mo
              </div>
              <div className="hidden font-mono text-[11px] uppercase tracking-[0.08em] text-ink-4 sm:block">
                {tier.perCredit} / credit
              </div>
              <div className="text-right font-medium text-ink sm:text-left">
                ${tier.price}
                <span className="text-[12px] font-normal text-ink-3">/mo</span>
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
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
                >
                  {tier.cta}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* One-time packs */}
      <div className="mb-10 rounded-xl border border-dashed border-line bg-paper-soft p-7 md:p-8">
        <div className="mb-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            One-time packs · no subscription
          </p>
          <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
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
              className="flex items-center justify-between rounded-md border border-line bg-surface px-4 py-3.5 transition-colors hover:bg-paper-2"
            >
              <div>
                <span className="font-medium text-ink">
                  {pack.credits} credits
                </span>
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
                  {pack.perCredit} / credit
                </span>
              </div>
              <span className="font-medium text-ink">${pack.price}</span>
            </a>
          ))}
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
          Subscribers pay less per credit — packs are the on-ramp to a plan.
        </p>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-dashed border-line px-6 py-5 sm:flex-row">
        <div>
          <p className="text-[14px] font-medium text-ink">Billing by Stripe</p>
          <p className="text-[12px] text-ink-3">
            Manage or cancel any time from your account. Prices in USD.
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          Secure · cancel any time · no hidden fees
        </p>
      </div>
    </Container>
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
          dark
            ? "mt-0.5 shrink-0 text-terracotta-soft"
            : "mt-0.5 shrink-0 text-terracotta"
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
