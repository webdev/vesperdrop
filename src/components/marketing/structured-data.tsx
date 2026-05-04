import { env } from "@/lib/env";

const SITE_DESCRIPTION =
  "AI lifestyle photography for Shopify and Amazon sellers. Drop a product photo, get a library of lifestyle shots in 90 seconds.";

function jsonLdScript(data: unknown) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  const base = env.SITE_URL.replace(/\/$/, "");
  // Logo points at /opengraph-image — a real PNG that satisfies Google's
  // ≥112×112 requirement. Swap to a square /icon route when one exists.
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Vesperdrop",
    url: base,
    logo: `${base}/opengraph-image`,
    description: SITE_DESCRIPTION,
    // Add social profiles here (Twitter, LinkedIn, Instagram, Pinterest,
    // Shopify App Store listing) to consolidate the brand entity in Google.
    sameAs: [] as string[],
  };
  return jsonLdScript(data);
}

export function WebSiteJsonLd() {
  const base = env.SITE_URL.replace(/\/$/, "");
  // No SearchAction — site search doesn't exist, and an invalid one
  // suppresses sitelinks. Re-add when /search is real.
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Vesperdrop",
    url: base,
    description: SITE_DESCRIPTION,
    inLanguage: "en-US",
  };
  return jsonLdScript(data);
}

type Offer = { name: string; priceUSD: number; description: string };

export function PricingProductJsonLd({ offers }: { offers: Offer[] }) {
  const base = env.SITE_URL.replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Vesperdrop",
    description:
      "AI lifestyle photography for Shopify and Amazon sellers. Turn rough product photos into conversion-optimized lifestyle batches.",
    brand: { "@type": "Brand", name: "Vesperdrop" },
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
  return jsonLdScript(data);
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
  return jsonLdScript(data);
}

/** A single preset rendered as a schema.org/CreativeWork inside ItemList. */
export type DiscoverItem = {
  name: string;
  description?: string;
  imageUrl?: string;
  slug: string;
};

/**
 * ItemList schema for /discover so Google can render the gallery as a
 * carousel rich result and index each scene preset as a CreativeWork.
 */
export function DiscoverItemListJsonLd({ items }: { items: DiscoverItem[] }) {
  const base = env.SITE_URL.replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Vesperdrop scene presets",
    description:
      "Lifestyle photography scene presets for AI-generated product imagery.",
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "CreativeWork",
        name: item.name,
        description: item.description,
        image: item.imageUrl,
        url: `${base}/discover#${item.slug}`,
      },
    })),
  };
  return jsonLdScript(data);
}
