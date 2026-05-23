import { Suspense } from "react";
import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { BeforeAfterSection } from "@/components/marketing/before-after-section";
import { Gallery } from "@/components/marketing/gallery";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Testimonials } from "@/components/marketing/testimonials";
import { Faq } from "@/components/marketing/faq";
import { ClosingCta } from "@/components/marketing/closing-cta";

export const metadata: Metadata = {
  title: {
    absolute: "Vesperdrop — lifestyle photography from a product shot",
  },
  description:
    "Drop a product photo, pick a scene, get a 6-image lifestyle batch in 90 seconds. Built for Etsy, Shopify, and Amazon sellers. 1 free HD shot, no card.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Vesperdrop — lifestyle photography from a product shot",
    description:
      "Drop a product photo, pick a scene, get a 6-image lifestyle batch in 90 seconds. Built for Etsy, Shopify, and Amazon sellers.",
    url: "/",
    type: "website",
  },
};

export default function Page() {
  return (
    <>
      <Hero />
      {/* Below-fold sections stream in after the hero shell. This lets the
          browser flush the hero HTML to the wire (and start painting LCP)
          without waiting on slow data fetches (e.g. Gallery's
          sceneify().listPublicPresets()) or large below-fold subtrees.
          VES-7 TC-7.10 structural fix. */}
      <Suspense fallback={null}>
        <BeforeAfterSection />
      </Suspense>
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
      <Suspense fallback={null}>
        <HowItWorks />
      </Suspense>
      <Suspense fallback={null}>
        <Testimonials />
      </Suspense>
      <Suspense fallback={null}>
        <Faq />
      </Suspense>
      <Suspense fallback={null}>
        <ClosingCta />
      </Suspense>
    </>
  );
}
