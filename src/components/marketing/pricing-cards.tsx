"use client";
import { useState } from "react";
import Link from "next/link";

type Props = { freeCap: number; proPrice: number; proCap: number };

export function PricingCards({ freeCap, proPrice, proCap }: Props) {
  // Yearly is purely a visual marker — Stripe checkout always uses the price ID
  // configured in env, which is the monthly Pro price. We surface the "save 20%"
  // framing for marketing only; an actual annual SKU would need a second price.
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const proCapLabel = proCap === 0 ? "Unlimited" : `${proCap} shots / month`;
  const cadenceLabel =
    billing === "yearly" ? "/mo · billed yearly" : "/month";

  return (
    <section className="mx-auto max-w-5xl px-6 pb-16">
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-[var(--color-line)] bg-[var(--color-cream)] p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            Free
          </p>
          <div className="mt-4 mb-1 flex items-baseline gap-1.5">
            <span className="font-serif text-5xl font-light text-[var(--color-ink)]">
              $0
            </span>
            <span className="text-sm text-[var(--color-ink-3)]">/month</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-2)]">
            Try the darkroom with watermarked previews. No card required.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-[var(--color-ink-2)]">
            <Feature>{freeCap} preview shots / month</Feature>
            <Feature>Diagonal watermark on outputs</Feature>
            <Feature>All scene presets</Feature>
            <Feature>Email support</Feature>
          </ul>
          <Link
            href="/sign-up"
            className="mt-7 inline-flex justify-center rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm font-medium text-[var(--color-cream)] transition-colors hover:bg-[var(--color-ink-2)]"
          >
            Start free
          </Link>
        </div>

        <div className="relative flex flex-col rounded-xl border border-[var(--color-ink)] bg-[var(--color-ink)] p-7 text-[var(--color-cream)]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-ember)] px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--color-cream)]">
            RECOMMENDED
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-4)]">
            Pro
          </p>
          <div className="mt-4 mb-1 flex items-baseline gap-1.5">
            <span className="font-serif text-5xl font-light">${proPrice}</span>
            <span className="text-sm text-[var(--color-ink-4)]">
              {cadenceLabel}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            For sellers shipping catalog. Full resolution, no watermark.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <Feature ember>{proCapLabel}</Feature>
            <Feature ember>No watermark, full 2000px resolution</Feature>
            <Feature ember>All scene presets + custom prompts</Feature>
            <Feature ember>Priority generation queue</Feature>
            <Feature ember>Cancel any time</Feature>
          </ul>
          <a
            href="/api/stripe/checkout"
            className="mt-7 inline-flex justify-center rounded-full bg-[var(--color-ember)] px-5 py-3 text-sm font-medium text-[var(--color-cream)] transition-colors hover:bg-[#a83c18]"
          >
            Upgrade to Pro &rarr;
          </a>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-xl border border-dashed border-[var(--color-line)] px-6 py-5 sm:flex-row">
        <div>
          <p className="text-sm font-medium text-[var(--color-ink)]">
            Billing by Stripe
          </p>
          <p className="text-xs text-[var(--color-ink-3)]">
            Manage or cancel any time from your account. Prices in USD.
          </p>
        </div>
        <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)]">
          SECURE &middot; CANCEL ANY TIME &middot; NO HIDDEN FEES
        </p>
      </div>
    </section>
  );
}

function Feature({
  children,
  ember,
}: {
  children: React.ReactNode;
  ember?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        className={ember ? "text-[var(--color-ember-soft)]" : "text-[var(--color-ember)]"}
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
