import type { Metadata } from "next";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { PricingFaq } from "@/components/marketing/pricing-faq";
import { PricingProductJsonLd } from "@/components/marketing/structured-data";
import { PLAN_CATALOG, PAID_PLAN_SLUGS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple credit-based pricing. 1 credit = 1 lifestyle shot at 2000px. Free tier with 1 HD generation, Pro from $49/mo for 200 credits. Cancel any time.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing · Vesperdrop",
    description:
      "Simple credit-based pricing. 1 credit = 1 lifestyle shot at 2000px. Free tier with 1 HD generation, Pro from $49/mo for 200 credits.",
    url: "/pricing",
    type: "website",
  },
};

const PRICING_OFFERS = [
  {
    name: "Free",
    priceUSD: 0,
    description:
      "1 full-resolution HD generation, 5 watermarked previews. No card required.",
  },
  {
    name: "Starter",
    priceUSD: 19,
    description: "50 credits per month, full resolution, no watermark.",
  },
  {
    name: "Pro",
    priceUSD: 49,
    description: "200 credits per month, priority queue, custom prompts.",
  },
  {
    name: "Studio",
    priceUSD: 149,
    description: "1,000 credits per month, bulk download, CSV export.",
  },
  {
    name: "Agency",
    priceUSD: 499,
    description: "5,000 credits per month, dedicated Slack support.",
  },
];

export default function Page() {
  return (
    <>
      <PricingProductJsonLd offers={PRICING_OFFERS} />
      <header className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center md:pt-20">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
          Pricing &middot; simple credits
        </p>
        <h1 className="mb-5 font-serif text-5xl font-light leading-[1.02] tracking-tight text-[var(--color-ink)] md:text-6xl">
          One credit.
          <br />
          <span className="italic">One lifestyle shot.</span>
        </h1>
        <p className="mx-auto max-w-xl font-serif text-lg font-light leading-snug text-[var(--color-ink-2)]">
          Try free — no card. Upgrade when you see the result.
          Credits roll over and never expire within your billing period.
        </p>
      </header>
      <PricingCards tiers={PAID_PLAN_SLUGS.map((slug) => PLAN_CATALOG[slug])} />
      <PricingFaq />
    </>
  );
}
