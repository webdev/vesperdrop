import { PricingCards } from "@/components/marketing/pricing-cards";
import { PricingFaq } from "@/components/marketing/pricing-faq";
import { env } from "@/lib/env";

export default function Page() {
  return (
    <>
      <header className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center md:pt-20">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
          Pricing &middot; simple plans
        </p>
        <h1 className="mb-5 font-serif text-5xl font-light leading-[1.02] tracking-tight text-[var(--color-ink)] md:text-6xl">
          One subscription.
          <br />
          <span className="italic">Every product.</span>
        </h1>
        <p className="mx-auto max-w-xl font-serif text-lg font-light leading-snug text-[var(--color-ink-2)]">
          Every plan includes A+ resolution, scene presets, and unlimited
          regenerations. Cancel any time.
        </p>
      </header>
      <PricingCards
        freeCap={env.PLAN_FREE_MONTHLY_GENERATIONS}
        proPrice={env.PLAN_PRO_PRICE_USD}
        proCap={env.PLAN_PRO_MONTHLY_GENERATIONS}
      />
      <PricingFaq />
    </>
  );
}
