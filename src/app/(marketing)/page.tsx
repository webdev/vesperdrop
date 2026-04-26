import { Hero } from "@/components/marketing/hero";
import { Gallery } from "@/components/marketing/gallery";
import { Discover } from "@/components/marketing/discover";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ClosingCta } from "@/components/marketing/closing-cta";

export default function Page() {
  return (
    <>
      <Hero />
      <Gallery />
      <Discover />
      <HowItWorks />
      <ClosingCta />
    </>
  );
}
