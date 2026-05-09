import type { Metadata } from "next";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: { absolute: "Contact · Vesperdrop" },
  description: "Get in touch with the Vesperdrop team.",
  alternates: { canonical: "/contact" },
  robots: { index: false, follow: true },
};

export default function ContactPage() {
  return (
    <Container width="marketing" className="py-20 md:py-28">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
        Get in touch
      </p>
      <h1 className="mt-3 font-serif text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[1.04] tracking-[-0.025em]">
        Contact
      </h1>
      <p className="mt-6 max-w-[58ch] text-[15px] leading-[1.65] text-ink-2">
        We read everything. Press, partnerships, support, or just feedback —
        send us a note and we&rsquo;ll get back within a business day.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <ContactCard
          label="General"
          email="hello@vesperdrop.com"
          body="Product questions, demos, or anything that doesn't fit a category below."
        />
        <ContactCard
          label="Support"
          email="support@vesperdrop.com"
          body="Account issues, billing, or trouble with a generation."
        />
        <ContactCard
          label="Press"
          email="press@vesperdrop.com"
          body="Editorial, partnerships, and brand collaborations."
        />
        <ContactCard
          label="Privacy & legal"
          email="legal@vesperdrop.com"
          body="Data requests, takedowns, and compliance enquiries."
        />
      </div>
    </Container>
  );
}

function ContactCard({
  label,
  email,
  body,
}: {
  label: string;
  email: string;
  body: string;
}) {
  return (
    <div className="rounded-[20px] border border-line-soft bg-cream/50 p-5 md:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
        {label}
      </p>
      <a
        href={`mailto:${email}`}
        className="mt-2 block font-serif text-[18px] tracking-[-0.01em] text-ink underline-offset-4 hover:underline"
      >
        {email}
      </a>
      <p className="mt-2 text-[13.5px] leading-[1.55] text-ink-3">{body}</p>
    </div>
  );
}
