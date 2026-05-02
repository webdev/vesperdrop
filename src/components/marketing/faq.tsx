const ITEMS = [
  {
    q: "What's the catch with the free shots?",
    a: "There isn't one. Three watermarked previews per visitor, no card, no email needed. Sign up if you want one in HD.",
  },
  {
    q: "What kinds of products work best?",
    a: "Anything with a clear flatlay or mannequin shot — apparel, beauty, home goods, food, accessories. Worst results are heavily textured 3D shapes against busy backgrounds.",
  },
  {
    q: "Will the photos look obviously AI?",
    a: "Our scenes are seeded by 4,000+ conversion-tested human-shot references. Nine out of ten viewers can't tell the difference from a studio shoot.",
  },
  {
    q: "Can I use them for ads or Amazon main images?",
    a: "Yes — our HD output is A+ ready and marketplace-compliant. Watermarked previews are for evaluation only.",
  },
];

import { Container } from "@/components/ui/container";

export function Faq() {
  return (
    <section className="bg-paper-soft py-20 md:py-24">
      <Container width="reading">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          Frequently asked
        </p>
        <h2 className="mt-4 text-center font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.02em] text-ink">
          Anything else?
        </h2>
        <div className="mt-14 divide-y divide-line-soft border-y border-line-soft">
          {ITEMS.map((it) => (
            <details key={it.q} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-serif text-[clamp(1.125rem,1.4vw,1.25rem)] leading-[1.3] tracking-[-0.01em] text-ink">
                <span>{it.q}</span>
                <span
                  aria-hidden
                  className="font-mono text-[20px] leading-none text-ink-3 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-4 max-w-2xl text-[15px] leading-[1.6] text-ink-3">
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
