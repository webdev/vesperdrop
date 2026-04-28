const QUOTES = [
  {
    quote: "Tripled my conversion rate the first week. No reshoots needed.",
    handle: "@oakandlinen",
    product: "Cropped Denim Jacket",
  },
  {
    quote: "Sold out in three days. Buyers thought I had a real studio.",
    handle: "@bloomintimates",
    product: "Pleated Mini Skirt",
  },
  {
    quote: "Made the listing look like a fashion editorial.",
    handle: "@northsider",
    product: "Linen Cami Dress",
  },
  {
    quote: "I shoot on a bedsheet. Customers see Vogue.",
    handle: "@plisséstudio",
    product: "Lace Bralette",
  },
];

export function Testimonials() {
  return (
    <section className="border-b border-[var(--color-ink)]">
      <div className="grid grid-cols-1 border-b border-[var(--color-line)] md:grid-cols-[240px_1fr]">
        <div className="border-b border-[var(--color-line)] px-6 py-8 md:border-r md:border-b-0 md:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            FIELD NOTES &middot; N&deg;04
          </p>
        </div>
        <div className="px-6 py-8 md:px-12">
          <h2 className="font-serif text-5xl font-light leading-[1.02] tracking-tight text-[var(--color-ink)] md:text-[72px]">
            Sellers speak.
            <br />
            <span className="italic">Numbers don&rsquo;t lie.</span>
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {QUOTES.map((item, idx) => (
          <div
            key={item.handle}
            className={`flex flex-col justify-between gap-6 px-8 py-10 md:px-12 md:py-12 ${
              idx % 2 === 0 ? "md:border-r md:border-[var(--color-line)]" : ""
            } ${idx < 2 ? "border-b border-[var(--color-line)]" : ""}`}
          >
            <p className="font-serif text-2xl font-light italic leading-snug text-[var(--color-ink)] md:text-3xl">
              &ldquo;{item.quote}&rdquo;
            </p>
            <div className="flex items-end justify-between gap-4 border-t border-[var(--color-line)] pt-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ember)]">
                {item.handle}
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--color-ink-3)]">
                {item.product.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
