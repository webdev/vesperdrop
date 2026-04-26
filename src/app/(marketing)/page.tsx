import { Hero } from "@/components/marketing/hero";
import { Gallery } from "@/components/marketing/gallery";
import { Discover } from "@/components/marketing/discover";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { CtaBand } from "@/components/marketing/cta-band";

export default function Page() {
  return (
    <>
      <Hero />
      <Gallery />
      <CtaBand
        eyebrow="OPEN AN ACCOUNT"
        headline={
          <>
            See it on <em>your</em> product.
          </>
        }
        ctaLabel="Try it free"
        ctaHref="/sign-up"
        caption="3 FREE SHOTS · NO CARD"
        tone="cream"
      />
      <Discover />
      <CtaBand
        eyebrow="DEVELOP YOUR LIBRARY"
        headline={
          <>
            Stop reshooting. <em>Start producing.</em>
          </>
        }
        ctaLabel="Create your first batch"
        ctaHref="/sign-up"
        tone="ink"
      />
      <HowItWorks />
      <ClosingCta />
    </>
  );
}
