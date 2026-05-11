import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { ContactForm } from "@/components/marketing/contact-form";

const TITLE = "Contact, talk to us about a custom plan";
const DESCRIPTION =
  "Custom plans for big brands, agencies, and high volume sellers. We reply within one business day.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · Vesperdrop` },
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
};

export default function Page() {
  return (
    <Container width="reading" className="pb-24 pt-20 md:pt-28">
      <header className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          Contact
        </p>
        <h1 className="mt-5 font-serif text-[clamp(2.5rem,5vw,3.75rem)] leading-[0.98] tracking-[-0.02em] text-ink">
          Tell us what you need.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.6] text-ink-3">
          Custom plans, API access, team seats, white label. We reply within
          one business day.
        </p>
      </header>
      <div className="mx-auto mt-12 max-w-xl">
        <Suspense fallback={null}>
          <ContactForm />
        </Suspense>
      </div>
    </Container>
  );
}
