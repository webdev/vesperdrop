import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import type { ComparisonRow } from "@/components/marketing/comparison-table";
import { PricingFaq } from "@/components/marketing/pricing-faq";
import { PricingProductJsonLd } from "@/components/marketing/structured-data";
import { Container } from "@/components/ui/container";
import { BillingProvider } from "@/components/marketing/billing-provider";
import { MonthlyAnnualToggle } from "@/components/marketing/monthly-annual-toggle";
import { PAID_PLAN_SLUGS, PLAN_MARKETING, PLAN_QUOTA } from "@/lib/plans";

const PRICING_TITLE = "Pricing, photo-based plans from $19/mo";
const PRICING_DESCRIPTION =
  "Photo-based plans for lifestyle product shots. Try free, no card. Annual saves 20%. Pro from $39/mo for 75 photos. Cancel any time.";

export const metadata: Metadata = {
  title: { absolute: `${PRICING_TITLE} · Vesperdrop` },
  description: PRICING_DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: PRICING_TITLE,
    description: PRICING_DESCRIPTION,
    url: "/pricing",
    type: "website",
  },
  twitter: { title: PRICING_TITLE, description: PRICING_DESCRIPTION },
};

const PRICING_OFFERS = [
  { name: "Free", priceUSD: 0, description: "1 full quality photo, 2 watermarked HD previews. No card needed." },
  { name: "Starter", priceUSD: 19, description: "25 photos per month, full resolution, no watermark." },
  { name: "Pro", priceUSD: 39, description: "75 photos per month, priority queue, custom prompts." },
  { name: "Studio", priceUSD: 99, description: "250 photos per month, full resolution, no watermark." },
  { name: "Agency", priceUSD: 499, description: "1,500 photos per month, API access, team seats, white label available." },
];

export default function Page() {
  const rows: ComparisonRow[] = PAID_PLAN_SLUGS.map((slug) => ({
    slug,
    marketing: PLAN_MARKETING[slug],
    quota: PLAN_QUOTA[slug],
  }));

  return (
    <>
      <PricingProductJsonLd offers={PRICING_OFFERS} />
      <Suspense fallback={null}>
        <BillingProvider>
          <Container as="header" width="reading" className="pb-10 pt-20 text-center md:pt-28">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              Pricing
            </p>
            <h1 className="mt-5 font-serif text-[clamp(3rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.02em] text-ink">
              Lifestyle shots for every product.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.6] text-ink-3">
              Try free, no card needed. Upgrade when you see the result. Photos refresh every billing cycle.
            </p>
            <div className="mt-8">
              <MonthlyAnnualToggle />
            </div>
          </Container>
          <PricingCards
            free={PLAN_MARKETING.free}
            pro={PLAN_MARKETING.pro}
            rows={rows}
          />
        </BillingProvider>
      </Suspense>
      <PricingFaq />
    </>
  );
}
