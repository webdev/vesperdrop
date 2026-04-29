import { env } from "@/lib/env";

export function OrganizationJsonLd() {
  const base = env.SITE_URL.replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Verceldrop",
    url: base,
    logo: `${base}/favicon.ico`,
    sameAs: [] as string[],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebSiteJsonLd() {
  const base = env.SITE_URL.replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Verceldrop",
    url: base,
    potentialAction: {
      "@type": "SearchAction",
      target: `${base}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

type Offer = { name: string; priceUSD: number; description: string };

export function PricingProductJsonLd({ offers }: { offers: Offer[] }) {
  const base = env.SITE_URL.replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Verceldrop",
    description:
      "AI lifestyle photography for Shopify and Amazon sellers. Turn rough product photos into conversion-optimized lifestyle batches.",
    brand: { "@type": "Brand", name: "Verceldrop" },
    url: `${base}/pricing`,
    offers: offers.map((o) => ({
      "@type": "Offer",
      name: o.name,
      description: o.description,
      price: o.priceUSD.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${base}/pricing`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FaqJsonLd({
  questions,
}: {
  questions: Array<{ question: string; answer: string }>;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
