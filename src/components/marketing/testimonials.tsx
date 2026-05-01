const REVIEWS = [
  {
    quote:
      "Replaced our studio days entirely. Three SKUs in the morning, six photos by lunch. Conversion didn't blink.",
    name: "Maren H.",
    role: "Buyer, Studio Halo",
    stars: 5,
  },
  {
    quote:
      "We used to pay $1,200 a shoot for our drops. Now we pay $49 a month and ship faster.",
    name: "Lucas P.",
    role: "Founder, Northbound Goods",
    stars: 5,
  },
  {
    quote:
      "The scenes feel like ones I'd pick myself. That's the part that surprised me — it's not generic AI imagery, it's our brand.",
    name: "Aiyana R.",
    role: "Creative Lead, Eden Skincare",
    stars: 5,
  },
];

export function Testimonials() {
  return (
    <section className="border-y border-zinc-100 bg-zinc-50/60 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="mb-14 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
              From our sellers
            </p>
            <h2 className="mt-3 text-[clamp(32px,4.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.02em] text-zinc-900">
              Brands you trust,
              <br />
              <span className="text-zinc-600">photos they keep.</span>
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <figure
              key={r.name}
              className="rounded-[20px] border border-zinc-200 bg-white p-7"
            >
              <div
                className="flex gap-0.5 text-amber-500"
                aria-label={`${r.stars} stars`}
              >
                {Array.from({ length: r.stars }).map((_, i) => (
                  <svg
                    key={i}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M12 2l2.928 6.728L22 9.5l-5.5 4.91L18 22 12 18.32 6 22l1.5-7.59L2 9.5l7.072-.772z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-4 text-[16px] leading-[1.55] text-zinc-800">
                &ldquo;{r.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-zinc-200" />
                <div>
                  <div className="text-[14px] font-medium text-zinc-900">
                    {r.name}
                  </div>
                  <div className="text-[12px] text-zinc-500">{r.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
