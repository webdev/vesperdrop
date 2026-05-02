import Link from "next/link";
import { Container } from "@/components/ui/container";
import { BeforeAfter, type Pair } from "./before-after";

const HERO_PAIR: Pair = {
  sku: "CAM-001",
  name: "Cami",
  surface: "Hanger flatlay",
  scene: "Velvet glow",
  before: "/marketing/before-after/cami_before.png",
  after: "/marketing/before-after/cami_after.png",
};

export function Hero() {
  return (
    <section className="relative">
      <Container width="marketing" className="pb-20 pt-16 md:pb-28 md:pt-24">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[1.05fr_1fr] md:gap-16">
          {/* Left — editorial copy */}
          <div className="order-2 md:order-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              AI lifestyle photography
            </p>
            <h1 className="mt-4 font-serif text-[clamp(3rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.02em] text-ink">
              From amateur photos to{" "}
              <em className="not-italic font-serif text-terracotta-dark italic">
                stunning
              </em>{" "}
              lifestyle images.
            </h1>
            <p className="mt-6 max-w-md text-[16px] leading-[1.55] text-ink-3">
              Drop a single product photo. We generate studio-quality images
              that sell — six looks in ninety seconds, zero shoot day.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Link
                href="/try"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
              >
                Try Vesperdrop free
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
              >
                See how it works
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line-soft pt-7 sm:grid-cols-4">
              <Stat label="Free shots" value="3" />
              <Stat label="Marketplace" value="A+ ready" />
              <Stat label="Per batch" value="~90s" />
              <Stat label="Pro from" value="$20" />
            </dl>
          </div>

          {/* Right — composed before/after visual */}
          <div className="order-1 md:order-2">
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
