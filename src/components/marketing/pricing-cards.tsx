import { env } from "@/lib/env";

export function PricingCards() {
  const proGenerations =
    env.PLAN_PRO_MONTHLY_GENERATIONS === 0
      ? "Unlimited"
      : env.PLAN_PRO_MONTHLY_GENERATIONS;

  return (
    <section className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-6 py-16 md:grid-cols-2">
      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-cream)] p-8">
        <h3 className="mb-2 font-serif text-2xl text-[var(--color-ink)]">
          Free
        </h3>
        <p className="mb-6 text-[var(--color-ink-3)]">Try it out.</p>
        <p className="mb-6 font-serif text-3xl text-[var(--color-ink)]">$0</p>
        <ul className="space-y-2 text-sm text-[var(--color-ink-2)]">
          <li>{env.PLAN_FREE_MONTHLY_GENERATIONS} images / month</li>
          <li>Watermarked previews</li>
        </ul>
      </div>
      <div className="rounded-lg border border-[var(--color-ink)] bg-[var(--color-ink)] p-8 text-[var(--color-cream)]">
        <h3 className="mb-2 font-serif text-2xl">Pro</h3>
        <p className="mb-6 opacity-70">For sellers shipping catalog.</p>
        <p className="mb-6 font-serif text-3xl">${env.PLAN_PRO_PRICE_USD}/mo</p>
        <ul className="space-y-2 text-sm">
          <li>{proGenerations} images / month</li>
          <li>No watermark, full resolution</li>
        </ul>
        <a
          href="/api/stripe/checkout"
          className="mt-6 block rounded bg-[var(--color-ember)] py-3 text-center text-sm font-medium text-[var(--color-cream)] transition-colors hover:bg-[#a83c18]"
        >
          Upgrade
        </a>
      </div>
    </section>
  );
}
