const STEPS = [
  {
    n: "01",
    title: "Upload",
    body: "Drop in your product shot — on white, on a bedsheet, on a table. We auto-extract the subject.",
  },
  {
    n: "02",
    title: "Pick a preset",
    body: "Choose a curated scene preset, from studio seamless to golden-hour hotel banquette.",
  },
  {
    n: "03",
    title: "Download",
    body: "Get a batch of lifestyle images at full resolution, ready for your storefront and ads.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-b border-[var(--color-line)] bg-[var(--color-paper-2)]"
    >
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            Process &middot; N&deg;03
          </p>
          <h2 className="font-serif text-4xl font-light leading-tight tracking-tight text-[var(--color-ink)] md:text-6xl">
            Three steps.
            <br />
            <span className="italic">No studio.</span>
          </h2>
        </div>
        <ol className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-0">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className={
                i < STEPS.length - 1
                  ? "md:border-r md:border-[var(--color-line)] md:pr-10"
                  : "md:pl-10"
              }
            >
              <div className={i > 0 && i < STEPS.length - 1 ? "md:pl-10" : ""}>
                <div className="mb-6 font-serif text-6xl font-light italic leading-none text-[var(--color-ember)]">
                  {step.n}
                </div>
                <h3 className="mb-3 font-serif text-2xl font-normal text-[var(--color-ink)]">
                  {step.title}
                </h3>
                <p className="font-serif text-base font-light leading-relaxed text-[var(--color-ink-2)]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
