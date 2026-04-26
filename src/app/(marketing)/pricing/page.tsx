import { PricingCards } from "@/components/marketing/pricing-cards";

export default function Page() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-6 pt-16 pb-4">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
          Rates &middot; N&deg;01
        </p>
        <h1 className="mb-2 font-serif text-4xl font-light tracking-tight text-[var(--color-ink)] md:text-5xl">
          Pricing
        </h1>
        <p className="font-serif text-lg font-light text-[var(--color-ink-3)]">
          Pay nothing to try it. Pro when you&rsquo;re shipping.
        </p>
      </header>
      <PricingCards />
    </>
  );
}
