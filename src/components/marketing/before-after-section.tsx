/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Container } from "@/components/ui/container";

const PAIRS = [
  {
    sku: "JKT-204",
    label: "Jacket",
    scene: "Urban canvas",
    before: "/marketing/before-after/jacket_before.png",
    after: "/marketing/before-after/jacket_after.png",
  },
  {
    sku: "SKT-018",
    label: "Skirt",
    scene: "Warm retreat",
    before: "/marketing/before-after/skirt_before.png",
    after: "/marketing/before-after/skirt_after.png",
  },
  {
    sku: "LCE-115",
    label: "Lace",
    scene: "Studio athletic",
    before: "/marketing/before-after/lace_before.png",
    after: "/marketing/before-after/lace_after.png",
  },
];

export function BeforeAfterSection() {
  return (
    <section className="bg-paper-soft py-24 md:py-32">
      <Container width="marketing">
        <div className="mb-14 flex flex-col items-end justify-between gap-6 md:mb-20 md:flex-row">
          <div className="md:max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              Real before / after
            </p>
            <h2 className="mt-4 font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.05] tracking-[-0.02em] text-ink">
              Flatlays in.{" "}
              <em className="not-italic font-serif italic text-terracotta-dark">
                Lifestyle
              </em>{" "}
              out.
            </h2>
          </div>
          <p className="text-[15px] leading-[1.6] text-ink-3 md:max-w-sm md:text-right">
            Same product, same upload — three different scenes. No props,
            no models, no studio. Ninety seconds each.
          </p>
        </div>

        <div className="space-y-16 md:space-y-20">
          {PAIRS.map((p, i) => (
            <article
              key={p.sku}
              className={`flex flex-col gap-6 md:items-center md:gap-12 ${
                i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
              }`}
            >
              {/* Editorial composition: dominant after + smaller before peek */}
              <div className="relative flex-1">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-line-soft bg-paper-2 shadow-soft">
                  <img
                    src={p.after}
                    alt={`${p.label} — lifestyle generation in ${p.scene.toLowerCase()}`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <span className="absolute bottom-4 left-4 inline-flex items-center rounded-full bg-cream/95 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink shadow-subtle">
                    After · Vesperdrop
                  </span>
                </div>
                <div
                  className="absolute -top-4 right-4 w-[28%] overflow-hidden rounded-md border border-line bg-cream shadow-card md:-top-6 md:right-6"
                  style={{ transform: "rotate(3deg)" }}
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
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
                  {p.sku}
                </p>
                <h3 className="mt-3 font-serif text-[clamp(1.625rem,2.5vw,2rem)] leading-[1.1] tracking-[-0.01em] text-ink">
                  {p.label}
                </h3>
                <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-3">
                  Scene · {p.scene}
                </p>
                <p className="mt-4 text-[14px] leading-[1.6] text-ink-3">
                  Upload one shot. Pick the look. Same product, transformed
                  scene — no re-shoot required.
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16 text-center md:mt-24">
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
