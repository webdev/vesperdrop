const FAQ = [
  {
    q: "What's a credit?",
    a: "One credit = one generated lifestyle image at full 2000px resolution. Your free shot, watermarked previews, and re-generations all use the same credit pool. Credits roll over and never expire within your billing period.",
  },
  {
    q: "What does the free tier actually give me?",
    a: "One full-resolution HD generation (no watermark, yours to keep) plus 5 watermarked 720p previews — no card required. You see a real result in ~90 seconds, then decide whether to subscribe.",
  },
  {
    q: "What's the watermark on the free previews?",
    a: "A diagonal stripe watermark across the 720p preview images. The moment you upgrade — even mid-session — the same images re-generate at full 2000px with no watermark. You see the upgrade happen in real time.",
  },
  {
    q: "How fast is a generation?",
    a: "Free previews (Flux Schnell) appear in ~8 seconds. Paid HD generations (Flux 1.1 Pro / Nano Banana 2) take 60–90 seconds per image. Pro subscribers get priority queue, so your jobs run first.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes — cancel from your account dashboard at any moment. You keep access and your remaining credits through the end of the current billing period. No questions asked.",
  },
  {
    q: "Do I own the images?",
    a: "Yes. Every generated image is yours to use commercially — Shopify, Amazon A+ content, Meta ads, TikTok Shop, your website. No attribution required.",
  },
  {
    q: "What about my source photos?",
    a: "Uploads are stored privately and used only to generate your batch. They're never used for model training or shared with any third party.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "You can top up with a one-time credit pack (10, 25, or 100 credits) without changing your subscription, or upgrade to the next tier. Subscribers always pay less per credit than one-time pack buyers.",
  },
];

export function PricingFaq() {
  return (
    <section className="mx-auto max-w-3xl border-t border-[var(--color-line)] px-6 py-16">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
        FAQ &middot; N&deg;03
      </p>
      <h2 className="mb-10 font-serif text-4xl font-light leading-tight tracking-tight text-[var(--color-ink)] md:text-5xl">
        Frequently asked.
      </h2>
      <ul className="divide-y divide-[var(--color-line)]">
        {FAQ.map((item) => (
          <li key={item.q}>
            <details className="group py-5">
              <summary className="flex cursor-pointer items-center justify-between gap-4 list-none text-left font-serif text-xl font-light text-[var(--color-ink)]">
                <span>{item.q}</span>
                <span className="font-mono text-2xl font-light text-[var(--color-ink-3)] transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl font-serif text-base font-light leading-relaxed text-[var(--color-ink-2)]">
                {item.a}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
