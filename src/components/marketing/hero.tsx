import Link from "next/link";
import { Container } from "@/components/ui/container";
import { BeforeAfter, type Pair } from "./before-after";

const HERO_PAIR: Pair = {
  sku: "CAM-001",
  name: "Cami",
  surface: "Hanger flatlay",
  scene: "Velvet glow",
  before: "/marketing/before-after/cami_before.webp",
  after: "/marketing/before-after/cami_after.webp",
};

export function Hero() {
  return (
    <section className="relative">
      <Container width="marketing" className="pb-16 pt-12 md:pb-24 md:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[1.05fr_1fr] md:gap-16">
          {/* Left — editorial copy. JSX order = mobile order: headline first, visual below. */}
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              For Etsy, Shopify &amp; Amazon apparel sellers
            </p>
            {/* Slight outdent on the H1 — masthead edge tension */}
            <h1 className="mt-4 font-serif text-[clamp(3rem,6vw,4.5rem)] leading-[0.96] tracking-[-0.02em] text-ink md:-ml-2">
              From a single flat lay to{" "}
              <em className="not-italic font-serif text-terracotta-dark italic">
                stunning
              </em>{" "}
              lifestyle images.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-[1.55] text-ink-3">
              Drop one flat lay. Get six on-model lifestyle photos in different
              scenes — in 90 seconds.
            </p>
            <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Link
                href="/try"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
              >
                Get your first photo free
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              No card required · First one&rsquo;s on us
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line-soft pt-6 sm:grid-cols-4">
              <Stat label="Per batch" value="6 photos" />
              <Stat label="Marketplace" value="A+ ready" />
              <Stat label="Time" value="~90s" />
              <Stat label="Pro from" value="$39/mo" />
            </dl>
          </div>

          {/* Right (desktop) / below (mobile) — composed before/after visual */}
          <div>
            <BeforeAfter pair={HERO_PAIR} />
          </div>
        </div>
      </Container>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
        {label}
      </dt>
      <dd className="mt-1.5 font-serif text-[20px] leading-none tracking-[-0.01em] text-ink">
        {value}
      </dd>
    </div>
  );
}
