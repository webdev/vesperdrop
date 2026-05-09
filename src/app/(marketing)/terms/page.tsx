import type { Metadata } from "next";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: { absolute: "Terms of service · Vesperdrop" },
  description: "Vesperdrop terms of service.",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <Container width="marketing" className="py-20 md:py-28">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
        Legal
      </p>
      <h1 className="mt-3 font-serif text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[1.04] tracking-[-0.025em]">
        Terms of service
      </h1>
      <div className="mt-8 max-w-[68ch] space-y-5 text-[15px] leading-[1.65] text-ink-2">
        <p>
          We&rsquo;re finalising the long-form terms. In the meantime, by using
          Vesperdrop you agree to a few simple things:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>You own the products and reference imagery you upload.</li>
          <li>
            Generated images are yours to use for your own brand, marketing,
            and ecommerce purposes.
          </li>
          <li>
            We don&rsquo;t claim copyright over your inputs or outputs.
          </li>
          <li>
            Don&rsquo;t use the service to generate misleading, defamatory, or
            illegal content.
          </li>
          <li>
            We may suspend access for clear policy abuse with notice where
            possible.
          </li>
        </ul>
        <p>
          The full agreement will be published here shortly. If you need it
          sooner for procurement, email{" "}
          <a
            href="mailto:hello@vesperdrop.com"
            className="text-ink underline underline-offset-4 hover:no-underline"
          >
            hello@vesperdrop.com
          </a>
          .
        </p>
      </div>
    </Container>
  );
}
