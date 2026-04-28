import { Hero } from "@/components/marketing/hero";
import { Gallery } from "@/components/marketing/gallery";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Testimonials } from "@/components/marketing/testimonials";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { CtaBand } from "@/components/marketing/cta-band";

export default function Page() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Gallery />
      <Testimonials />
      <CtaBand
        eyebrow="DEVELOP YOUR LIBRARY"
        headline={
          <>
            Stop reshooting. <em>Start producing.</em>
          </>
        }
        ctaLabel="Get your free shot"
        ctaHref="/try"
        caption="1 FREE HD SHOT · NO CARD · UPGRADE WHEN YOU SEE IT"
        tone="ink"
      />
      <ClosingCta />
    </>
  );
}
