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

export function Faq() {
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        <p className="text-center text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
          Frequently asked
        </p>
        <h2 className="mt-3 text-center text-[clamp(28px,4vw,44px)] font-semibold leading-[1.1] tracking-[-0.02em] text-zinc-900">
          Anything else?
        </h2>
        <div className="mt-12 divide-y divide-zinc-200 border-y border-zinc-200">
          {ITEMS.map((it) => (
            <details key={it.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-medium tracking-tight text-zinc-900">
                <span>{it.q}</span>
                <span
                  aria-hidden
                  className="text-zinc-400 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-[1.6] text-zinc-600">
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
