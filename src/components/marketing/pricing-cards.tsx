"use client";
import { useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";

const TIERS = [
  {
    id: "starter",
    label: "Starter",
    price: { monthly: 19, yearly: 16 },
    credits: 50,
    effectivePerCredit: { monthly: "38¢", yearly: "31¢" },
    features: [
      "50 credits / month",
      "Full resolution, no watermark",
      "All scene presets",
      "Email support",
    ],
    cta: "Start Starter",
    href: "/api/stripe/checkout?plan=starter",
    recommended: false,
  },
  {
    id: "pro",
    label: "Pro",
    price: { monthly: 49, yearly: 39 },
    credits: 200,
    effectivePerCredit: { monthly: "25¢", yearly: "20¢" },
    features: [
      "200 credits / month",
      "Full resolution, no watermark",
      "All scene presets + custom prompts",
      "Priority generation queue",
      "Cancel any time",
    ],
    cta: "Start Pro",
    href: "/api/stripe/checkout?plan=pro",
    recommended: true,
  },
  {
    id: "studio",
    label: "Studio",
    price: { monthly: 149, yearly: 119 },
    credits: 1000,
    effectivePerCredit: { monthly: "15¢", yearly: "12¢" },
    features: [
      "1,000 credits / month",
      "Full resolution, no watermark",
      "All scene presets + custom prompts",
      "Priority generation queue",
      "Bulk download & CSV export",
      "Cancel any time",
    ],
    cta: "Start Studio",
    href: "/api/stripe/checkout?plan=studio",
    recommended: false,
  },
  {
    id: "agency",
    label: "Agency",
    price: { monthly: 499, yearly: 399 },
    credits: 5000,
    effectivePerCredit: { monthly: "10¢", yearly: "8¢" },
    features: [
      "5,000 credits / month",
      "Full resolution, no watermark",
      "All scene presets + custom prompts",
      "Priority generation queue",
      "Bulk download & CSV export",
      "Dedicated Slack support",
      "Cancel any time",
    ],
    cta: "Start Agency",
    href: "/api/stripe/checkout?plan=agency",
    recommended: false,
  },
];

const ONE_TIME_PACKS = [
  { credits: 10, price: 9, perCredit: "90¢" },
  { credits: 25, price: 19, perCredit: "76¢" },
  { credits: 100, price: 59, perCredit: "59¢" },
];

export function PricingCards() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20">
      {/* Billing toggle */}
      <div className="mb-10 flex justify-center">
        <div className="inline-flex rounded-full bg-[var(--color-paper-2)] p-1">
          {(
            [
              { id: "monthly", label: "Monthly" },
              { id: "yearly", label: "Yearly · save 20%" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setBilling(t.id)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                billing === t.id
                  ? "bg-[var(--color-cream)] text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-ink-3)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Free vs Pro hero cards */}
      <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Free card */}
        <div className="flex flex-col rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            Free
          </p>
          <div className="mt-4 mb-1 flex items-baseline gap-1.5">
            <span className="font-serif text-5xl font-light text-[var(--color-ink)]">$0</span>
            <span className="text-sm text-[var(--color-ink-3)]">/month</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-2)]">
            Try Verceldrop. No card required.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-[var(--color-ink-2)]">
            <Feature>1 full-resolution HD generation</Feature>
            <Feature>5 watermarked 720p previews</Feature>
            <Feature>All scene presets</Feature>
            <Feature>Email support</Feature>
          </ul>
          <Link
            href="/try"
            className="mt-7 inline-flex justify-center rounded-full border border-[var(--color-ink)] px-5 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-paper-2)]"
          >
            Try free — no account needed
          </Link>
        </div>

        {/* Pro card */}
        <div className="relative flex flex-col rounded-xl border border-[var(--color-ink)] bg-[var(--color-ink)] p-7 text-[var(--color-cream)]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-ember)] px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--color-cream)]">
            MOST POPULAR
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-4)]">
            Pro
          </p>
          <div className="mt-4 mb-1 flex items-baseline gap-1.5">
            <span className="font-serif text-5xl font-light">
              ${billing === "monthly" ? 49 : 39}
            </span>
            <span className="text-sm text-[var(--color-ink-4)]">
              {billing === "yearly" ? "/mo · billed yearly" : "/month"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            For sellers refreshing 30–100 SKUs/quarter. 200 credits covers it comfortably.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <Feature ember>200 credits / month</Feature>
            <Feature ember>Full resolution, no watermark</Feature>
            <Feature ember>All scene presets + custom prompts</Feature>
            <Feature ember>Priority generation queue</Feature>
            <Feature ember>Cancel any time</Feature>
          </ul>
          <a
            href="/api/stripe/checkout?plan=pro"
            onClick={() => track("pricing_plan_clicked", { plan: "pro", billing })}
            className="mt-7 inline-flex justify-center rounded-full bg-[var(--color-ink)] border border-[var(--color-cream)]/30 px-5 py-3 text-sm font-medium text-[var(--color-cream)] transition-colors hover:bg-[var(--color-ink-2)]"
          >
            Start Pro &rarr;
          </a>
          <p className="mt-3 text-center font-mono text-[10px] tracking-[0.12em] text-[var(--color-cream)]/40">
            {billing === "yearly" ? "25¢" : "25¢"} PER CREDIT &middot; CANCEL ANY TIME
          </p>
        </div>
      </div>

      {/* Full tier table */}
      <div className="mb-5 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)]">
        <div className="border-b border-[var(--color-line)] px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            All plans &middot; credits never expire within your billing period
          </p>
        </div>
        <div className="divide-y divide-[var(--color-line)]">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-4 sm:grid-cols-[140px_1fr_80px_100px_120px] ${
                tier.recommended ? "bg-[var(--color-paper-2)]" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--color-ink)]">{tier.label}</span>
                {tier.recommended && (
                  <span className="rounded-full bg-[var(--color-ember)] px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] text-[var(--color-cream)]">
                    POPULAR
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-sm text-[var(--color-ink-3)]">
                {tier.credits.toLocaleString()} credits / mo
              </div>
              <div className="hidden sm:block font-mono text-[11px] text-[var(--color-ink-3)]">
                {tier.effectivePerCredit[billing]} / credit
              </div>
              <div className="text-right sm:text-left font-medium text-[var(--color-ink)]">
                ${billing === "monthly" ? tier.price.monthly : tier.price.yearly}
                <span className="text-xs font-normal text-[var(--color-ink-3)]">/mo</span>
              </div>
              <div className="hidden sm:flex justify-end">
                <a
                  href={tier.href}
                  onClick={() => track("pricing_plan_clicked", { plan: tier.id, billing })}
                  className="inline-flex items-center rounded-full border border-[var(--color-ink)] px-4 py-1.5 font-mono text-[10px] tracking-[0.08em] text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-[var(--color-cream)]"
                >
                  {tier.cta}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* One-time packs */}
      <div className="mb-10 overflow-hidden rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-cream)] p-6">
        <div className="mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            One-time packs &middot; no subscription
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-2)]">
            Not ready to subscribe? Buy credits once. They don&rsquo;t expire.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ONE_TIME_PACKS.map((pack) => (
            <a
              key={pack.credits}
              href={`/api/stripe/checkout?plan=pack-${pack.credits}`}
              onClick={() => track("pricing_pack_clicked", { credits: pack.credits })}
              className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-2)] px-4 py-3 transition-colors hover:border-[var(--color-ink)]"
            >
              <div>
                <span className="font-medium text-[var(--color-ink)]">{pack.credits} credits</span>
                <span className="ml-2 font-mono text-[10px] text-[var(--color-ink-3)]">
                  {pack.perCredit}/credit
                </span>
              </div>
              <span className="font-medium text-[var(--color-ink)]">${pack.price}</span>
            </a>
          ))}
        </div>
        <p className="mt-4 font-mono text-[10px] tracking-[0.1em] text-[var(--color-ink-3)]">
          Subscribers pay less per credit — packs are the on-ramp to a plan.
        </p>
      </div>

      {/* Trust footer */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-dashed border-[var(--color-line)] px-6 py-5 sm:flex-row">
        <div>
          <p className="text-sm font-medium text-[var(--color-ink)]">Billing by Stripe</p>
          <p className="text-xs text-[var(--color-ink-3)]">
            Manage or cancel any time from your account. Prices in USD.
          </p>
        </div>
        <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)]">
          SECURE &middot; CANCEL ANY TIME &middot; NO HIDDEN FEES
        </p>
      </div>
    </div>
  );
}

function Feature({ children, ember }: { children: React.ReactNode; ember?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        className={ember ? "mt-0.5 shrink-0 text-[var(--color-ember-soft)]" : "mt-0.5 shrink-0 text-[var(--color-ember)]"}
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
