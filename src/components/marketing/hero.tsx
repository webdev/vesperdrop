import Link from "next/link";
import { BeforeAfter, type Pair } from "./before-after";

const PAIRS: Pair[] = [
  {
    sku: "JKT-08",
    name: "Cropped Denim Jacket",
    surface: "Hung on door · iPhone",
    scene: "Hotel banquette · golden hour",
    before: "/marketing/before-after/jacket_before.png",
    after: "/marketing/before-after/jacket_after.png",
  },
  {
    sku: "SKT-14",
    name: "Pleated Mini Skirt",
    surface: "On bedsheet · phone flatlay",
    scene: "Studio seamless · soft strobe",
    before: "/marketing/before-after/skirt_before.png",
    after: "/marketing/before-after/skirt_after.png",
  },
  {
    sku: "CAM-BRN-S",
    name: "Linen Cami Dress",
    surface: "On mannequin · cellphone",
    scene: "Studio · golden hour",
    before: "/marketing/before-after/cami_before.png",
    after: "/marketing/before-after/cami_after.png",
  },
  {
    sku: "BRL-RSE-M",
    name: "Lace Bralette",
    surface: "On wood table · phone flatlay",
    scene: "Studio seamless · soft daylight",
    before: "/marketing/before-after/lace_before.png",
    after: "/marketing/before-after/lace_after.png",
  },
];

export function Hero() {
  return (
    <section className="border-b border-[var(--color-ink)]">
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-between gap-12 border-b border-[var(--color-ink)] px-6 py-14 md:border-r md:border-b-0 md:px-12 md:py-16">
          <div>
            <p className="mb-8 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-3)]">
              FEATURE &middot; N&deg;01
            </p>
            <h1 className="font-serif text-[clamp(56px,8vw,112px)] font-light leading-[0.96] tracking-tight text-[var(--color-ink)]">
              Your product,
              <br />
              <span className="italic">on location</span>.
              <br />
              <span className="text-[var(--color-ember)]">In minutes.</span>
            </h1>
            <p className="mt-7 max-w-lg font-serif text-xl font-light leading-snug text-[var(--color-ink-2)] md:text-[22px]">
              Drop in a plain product shot. Darkroom returns a library of
              lifestyle photographs &mdash; kitchens, counters, coffee tables,
              gardens &mdash; ready for your Amazon listing, A+ content, and
              ads.
            </p>
          </div>

          <div>
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center rounded-full bg-[var(--color-ember)] px-7 py-4 text-sm md:text-base font-medium text-[var(--color-cream)] transition-transform hover:scale-[1.02] hover:bg-[#a83c18]"
              >
                Try with your product &rarr;
              </Link>
              <Link
                href="/pricing"
                className="border-b border-[var(--color-ink)] pb-1 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-ember)] hover:text-[var(--color-ember)]"
              >
                See pricing
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-[var(--color-ink)] pt-4 font-mono text-[10px] tracking-[0.14em] text-[var(--color-ink-3)]">
              <div>
                3 FREE SHOTS
                <br />
                <span className="text-[var(--color-ink)]">NO CARD</span>
              </div>
              <div>
                A+ READY
                <br />
                <span className="text-[var(--color-ink)]">2000PX SQUARE</span>
              </div>
              <div>
                ~90 SECONDS
                <br />
                <span className="text-[var(--color-ink)]">PER BATCH</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-ink)] p-6 md:p-10">
          <BeforeAfter pairs={PAIRS} />
        </div>
      </div>
    </section>
  );
}
