import Link from "next/link";
import { Container } from "@/components/ui/container";

/**
 * Honest stand-in for customer testimonials until real ones exist. Per the
 * FTC: don't fake names. Per the strategy doc: don't ship the page without
 * addressing social proof in some form — so reframe to "the free photo is
 * the proof" and add a brief founder/team line.
 */
export function Testimonials() {
  return (
    <section className="bg-paper py-20 md:py-24">
      <Container width="reading">
        <div className="text-center md:text-left">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            On proof
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.02em] text-ink md:mx-0">
            Instead of testimonials,{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              run it on your own product.
            </em>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-[1.6] text-ink-3 md:mx-0">
            We&rsquo;re new. The fastest way to see if this works is the same
            way we know it does — drop your flat lay in, watch the scenes come
            back. Built by a team that&rsquo;s lived the apparel content
            velocity problem: too many SKUs, too few shoot days.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 md:flex-row md:items-center">
            <Link
              href="/try"
              className="inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
            >
              Run your own photo
              <span aria-hidden>→</span>
            </Link>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              No card required
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
