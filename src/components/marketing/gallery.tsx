/* eslint-disable @next/next/no-img-element */

const PAIRS = [
  {
    sku: "JKT-08",
    name: "Cropped Denim Jacket",
    surface: "Hung on door · iPhone",
    scene: "Hotel banquette · golden hour",
    before: "/marketing/before-after/jacket_before.png",
    after: "/marketing/before-after/jacket_after.png",
    quote: "Tripled my conversion rate the first week. No reshoots needed.",
    handle: "@oakandlinen",
  },
  {
    sku: "SKT-14",
    name: "Pleated Mini Skirt",
    surface: "On bedsheet · phone flatlay",
    scene: "Studio seamless · soft strobe",
    before: "/marketing/before-after/skirt_before.png",
    after: "/marketing/before-after/skirt_after.png",
    quote: "Sold out in three days. Buyers thought I had a real studio.",
    handle: "@bloomintimates",
  },
  {
    sku: "CAM-BRN-S",
    name: "Linen Cami Dress",
    surface: "On mannequin · cellphone",
    scene: "Studio · golden hour",
    before: "/marketing/before-after/cami_before.png",
    after: "/marketing/before-after/cami_after.png",
    quote: "Made the listing look like a fashion editorial.",
    handle: "@northsider",
  },
  {
    sku: "BRL-RSE-M",
    name: "Lace Bralette",
    surface: "On wood table · phone flatlay",
    scene: "Studio seamless · soft daylight",
    before: "/marketing/before-after/lace_before.png",
    after: "/marketing/before-after/lace_after.png",
    quote: "I shoot on a bedsheet. Customers see Vogue.",
    handle: "@plisséstudio",
  },
];

export function Gallery() {
  return (
    <section id="gallery" className="border-b border-[var(--color-ink)]">
      <div className="grid grid-cols-1 border-b border-[var(--color-line)] md:grid-cols-[240px_1fr]">
        <div className="flex flex-col justify-between gap-6 border-b border-[var(--color-line)] px-6 py-8 md:border-r md:border-b-0 md:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            CONTACT SHEET &middot; N&deg;02
          </p>
          <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-[var(--color-ink-3)]">
            BATCH_2847
            <br />
            HERO PAIRS
            <br />4 EXPOSURES
          </p>
        </div>
        <div className="px-6 py-8 md:px-12">
          <h2 className="font-serif text-5xl font-light leading-[1.02] tracking-tight text-[var(--color-ink)] md:text-[72px]">
            Flat on the floor.
            <br />
            <span className="italic">Out in the world.</span>
          </h2>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
            Two phone snapshots. Eight seconds in the studio. Zero retouching.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {PAIRS.map((pair, idx) => (
          <div
            key={pair.sku}
            className={`px-6 py-8 md:px-10 md:py-10 ${
              idx % 2 === 0
                ? "md:border-r md:border-[var(--color-line)]"
                : ""
            } ${idx < 2 ? "border-b border-[var(--color-line)]" : ""}`}
          >
            <div className="mb-4 flex items-baseline justify-between border-b border-[var(--color-line)] pb-3 font-mono text-[10px] tracking-[0.14em] text-[var(--color-ink-3)]">
              <span>
                FIG. 0{idx + 1} &middot; {pair.sku}
              </span>
              <span className="text-[var(--color-ink-2)]">
                {pair.name.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_28px_1fr] items-center">
              <div className="relative">
                <div className="aspect-square overflow-hidden bg-[var(--color-paper-2)]">
                  <img
                    src={pair.before}
                    alt={`${pair.name} before`}
                    className="block h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="absolute top-2.5 left-2.5 bg-[rgba(250,247,240,0.92)] px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-[var(--color-ink)]">
                  BEFORE &middot; INPUT
                </div>
                <div className="mt-2.5 font-mono text-[10px] tracking-[0.1em] text-[var(--color-ink-3)]">
                  {pair.surface.toUpperCase()}
                </div>
              </div>

              <div className="text-center text-[var(--color-ink-3)]">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  className="mx-auto"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>

              <div className="relative">
                <div className="aspect-square overflow-hidden bg-[var(--color-ink)]">
                  <img
                    src={pair.after}
                    alt={`${pair.name} after`}
                    className="block h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="absolute top-2.5 left-2.5 bg-[var(--color-ember)] px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-[var(--color-cream)]">
                  AFTER &middot; VESPERDROP
                </div>
                <div className="mt-2.5 font-mono text-[10px] tracking-[0.1em] text-[var(--color-ink-3)]">
                  {pair.scene.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 border-t border-[var(--color-line)] pt-4">
              <p className="font-serif text-base italic text-[var(--color-ink-2)]">
                &ldquo;{pair.quote}&rdquo;
              </p>
              <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-[var(--color-ink-3)]">
                &mdash; {pair.handle}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
