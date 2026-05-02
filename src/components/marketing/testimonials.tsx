const REVIEWS = [
  {
    quote:
      "Replaced our studio days entirely. Three SKUs in the morning, six photos by lunch. Conversion didn't blink.",
    name: "Maren H.",
    role: "Buyer, Studio Halo",
  },
  {
    quote:
      "We used to pay $1,200 a shoot for our drops. Now we pay $49 a month and ship faster.",
    name: "Lucas P.",
    role: "Founder, Northbound Goods",
  },
  {
    quote:
      "The scenes feel like ones I'd pick myself. That's the part that surprised me — it's not generic AI imagery, it's our brand.",
    name: "Aiyana R.",
    role: "Creative Lead, Eden Skincare",
  },
];

import { Container } from "@/components/ui/container";

export function Testimonials() {
  return (
    <section className="bg-paper py-20 md:py-24">
      <Container width="marketing">
        <div className="mb-12 md:mb-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Field notes · N°04
          </p>
          <h2 className="mt-4 font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-ink">
            Brands you trust,{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              photos they keep.
            </em>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-12 lg:gap-16">
          {REVIEWS.map((r, i) => {
            const isLead = i === 0;
            return (
              <figure
                key={r.name}
                className={`flex h-full flex-col border-t border-line-soft pt-6 ${
                  i === 1 ? "md:translate-y-8" : i === 2 ? "md:translate-y-3" : ""
                }`}
              >
                <blockquote
                  className={
                    isLead
                      ? "font-serif text-[clamp(1.75rem,2.6vw,2.5rem)] leading-[1.15] tracking-[-0.02em] text-ink"
                      : "font-serif text-[clamp(1.125rem,1.4vw,1.25rem)] leading-[1.4] tracking-[-0.005em] text-ink"
                  }
                >
                  &ldquo;{r.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-auto pt-8">
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
                    {r.name}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
                    {r.role}
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
