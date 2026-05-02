import Link from "next/link";
import { Container } from "@/components/ui/container";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-cream md:py-32">
      <div
        aria-hidden
        className="absolute inset-0 -z-0 bg-gradient-to-br from-terracotta/25 via-terracotta/5 to-transparent blur-3xl"
      />
      <Container width="reading" className="relative text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cream/60">
          Three free shots, on us
        </p>
        <h2 className="mt-5 font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.02em]">
          Stop reshooting.{" "}
          <em className="not-italic font-serif italic text-cream/55">
            Start producing.
          </em>
        </h2>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/try"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
          >
            Try with your photo
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-cream/25 bg-transparent px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-cream/10"
          >
            See pricing
          </Link>
        </div>
      </Container>
    </section>
  );
}
