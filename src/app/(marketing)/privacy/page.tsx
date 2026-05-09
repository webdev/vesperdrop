import type { Metadata } from "next";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: { absolute: "Privacy policy · Vesperdrop" },
  description: "Vesperdrop privacy policy.",
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <Container width="marketing" className="py-20 md:py-28">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
        Legal
      </p>
      <h1 className="mt-3 font-serif text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[1.04] tracking-[-0.025em]">
        Privacy policy
      </h1>
      <div className="mt-8 max-w-[68ch] space-y-5 text-[15px] leading-[1.65] text-ink-2">
        <p>
          Short version while the long-form policy is being prepared:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            We store your account email, the images you upload, and the images
            we generate so we can show them back to you.
          </li>
          <li>
            We use third-party services to deliver the product (auth,
            payments, image generation, hosting, analytics). They process the
            minimum data required for their function.
          </li>
          <li>
            We don&rsquo;t sell your data and we don&rsquo;t train public
            models on your uploads.
          </li>
          <li>
            You can request export or deletion of your data at any time by
            emailing us.
          </li>
        </ul>
        <p>
          The full policy with sub-processor list, retention, and your
          rights under GDPR/CCPA will be published here shortly. Questions in
          the meantime:{" "}
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
