/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Container } from "@/components/ui/container";

type RowLayout = {
  /** flex direction at md+ */
  direction: "row" | "row-reverse";
  /** "after" image aspect ratio */
  afterAspect: string;
  /** before-peek positioning (corner + rotation) */
  before: {
    corner: string; // tailwind utility classes for absolute positioning
    rotate: string;
    width: string;
  };
  /** optional vertical offset on the whole row to break the baseline */
  rowOffset?: string;
};

type Pair = {
  sku: string;
  label: string;
  scene: string;
  before: string;
  after: string;
  layout: RowLayout;
};

const PAIRS: Pair[] = [
  {
    sku: "JKT-204",
    label: "Jacket",
    scene: "Urban canvas",
    before: "/marketing/before-after/jacket_before.png",
    after: "/marketing/before-after/jacket_after.png",
    layout: {
      direction: "row",
      afterAspect: "aspect-[4/5]",
      before: {
        corner: "-top-4 right-4 md:-top-6 md:right-6",
        rotate: "rotate-3",
        width: "w-[28%]",
      },
    },
  },
  {
    sku: "SKT-018",
    label: "Skirt",
    scene: "Warm retreat",
    before: "/marketing/before-after/skirt_before.png",
    after: "/marketing/before-after/skirt_after.png",
    layout: {
      direction: "row-reverse",
      // Taller, more dominant — center moment of the section
      afterAspect: "aspect-[3/4]",
      before: {
        corner: "-bottom-6 left-4 md:-bottom-8 md:left-8",
        rotate: "-rotate-4",
        width: "w-[26%]",
      },
      rowOffset: "md:translate-y-6",
    },
  },
  {
    sku: "LCE-115",
    label: "Lace",
    scene: "Studio athletic",
    before: "/marketing/before-after/lace_before.png",
    after: "/marketing/before-after/lace_after.png",
    layout: {
      direction: "row",
      // Wider — landscape moment to break the portrait rhythm
      afterAspect: "aspect-[5/4]",
      before: {
        corner: "-top-5 left-5 md:-top-6 md:left-8",
        rotate: "-rotate-2",
        width: "w-[24%]",
      },
      rowOffset: "md:-translate-y-2",
    },
  },
];

export function BeforeAfterSection() {
  return (
    <section className="bg-paper-soft py-20 md:py-24">
      <Container width="marketing">
        <div className="mb-12 flex flex-col items-end justify-between gap-6 md:mb-16 md:flex-row">
          <div className="md:max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              Real before / after
            </p>
            <h2 className="mt-4 font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-ink">
              Flatlays in.{" "}
              <em className="not-italic font-serif italic text-terracotta-dark">
                Lifestyle
              </em>{" "}
              out.
            </h2>
          </div>
          <p className="text-[15px] leading-[1.55] text-ink-3 md:max-w-sm md:text-right">
            Same product, same upload — three different scenes. No props,
            no models, no studio. Ninety seconds each.
          </p>
        </div>

        <div className="space-y-20 md:space-y-24">
          {PAIRS.map((p, i) => (
            <article
              key={p.sku}
              className={`flex flex-col gap-6 md:items-center md:gap-12 ${
                p.layout.direction === "row" ? "md:flex-row" : "md:flex-row-reverse"
              } ${p.layout.rowOffset ?? ""}`}
            >
              {/* Editorial composition: dominant after + before peek varies per row */}
              <div className="relative flex-1">
                <div
                  className={`relative ${p.layout.afterAspect} overflow-hidden rounded-xl border border-line-soft bg-paper-2 shadow-soft`}
                >
                  <img
                    src={p.after}
                    alt={`${p.label} — lifestyle generation in ${p.scene.toLowerCase()}`}
                    className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
                  />
                  <span className="absolute bottom-4 left-4 inline-flex items-center rounded-full bg-cream/95 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink shadow-subtle">
                    After · Vesperdrop
                  </span>
                </div>
                <div
                  className={`absolute ${p.layout.before.corner} ${p.layout.before.width} overflow-hidden rounded-md border border-line bg-cream shadow-card ${p.layout.before.rotate}`}
                >
                  <div className="relative aspect-[4/5]">
                    <img
                      src={p.before}
                      alt={`${p.label} — original flatlay`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <span className="absolute left-2 top-2 inline-flex items-center rounded-sm bg-ink/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-cream backdrop-blur-sm">
                      Before
                    </span>
                  </div>
                </div>
              </div>

              {/* Caption side */}
              <div className="md:w-[280px] md:shrink-0">
                <p className="font-serif text-[clamp(2.25rem,3.5vw,3rem)] italic leading-none tracking-[-0.02em] text-terracotta-dark">
                  N°{String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
                  {p.sku}
                </p>
                <h3 className="mt-2 font-serif text-[clamp(1.625rem,2.5vw,2rem)] leading-[1.1] tracking-[-0.01em] text-ink">
                  {p.label}
                </h3>
                <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-3">
                  Scene · {p.scene}
                </p>
                <p className="mt-4 text-[14px] leading-[1.55] text-ink-3">
                  Upload one shot. Pick the look. Same product, transformed
                  scene — no re-shoot required.
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16 text-center md:mt-20">
          <Link
            href="/try"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
          >
            Try with your photo <span aria-hidden>→</span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
