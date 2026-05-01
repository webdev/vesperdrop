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
      <header className="mx-auto max-w-3xl px-6 pt-20 pb-12 text-center md:pt-28">
        <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
          Pricing · simple credits
        </p>
        <h1 className="mt-4 text-[clamp(40px,5.5vw,72px)] font-semibold leading-[1.05] tracking-[-0.02em] text-zinc-900">
          One credit.
          <br />
          <span className="text-zinc-600">One lifestyle shot.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.6] text-zinc-600">
          Try free — no card. Upgrade when you see the result. Credits roll
          over and never expire within your billing period.
        </p>
      </header>
      <PricingCards tiers={PAID_PLAN_SLUGS.map((slug) => PLAN_CATALOG[slug])} />
      <PricingFaq />
    </>
  );
}
