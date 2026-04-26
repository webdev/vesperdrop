const FAQ = [
  {
    q: "How fast is a batch?",
    a: "Most batches finish in 60–120 seconds. You'll see them stream in one frame at a time as the queue completes.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes — cancel from your account dashboard. You keep Pro access through the end of the current billing period.",
  },
  {
    q: "Do I own the images?",
    a: "Yes. Generated images are yours to use commercially across Shopify, Amazon, Meta ads, and your website.",
  },
  {
    q: "What about my source photos?",
    a: "Source uploads are stored privately and only used to generate your batch. They're never used for training.",
  },
  {
    q: "Can I get more than 6 images per batch?",
    a: "Pro can re-run any batch with new presets as many times as your monthly cap allows.",
  },
];

export function PricingFaq() {
  return (
    <section className="mx-auto max-w-3xl border-t border-[var(--color-line)] px-6 py-16">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
        FAQ &middot; N&deg;02
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
