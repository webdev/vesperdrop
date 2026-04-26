const STEPS = [
  {
    n: "01",
    title: "Upload",
    body: "Drop in your Amazon main image or any product shot on white. We auto-extract the subject.",
  },
  {
    n: "02",
    title: "Pick scenes",
    body: "Choose from curated scene presets — studio, city, cafe, trail — or describe the mood in your own words.",
  },
  {
    n: "03",
    title: "Download",
    body: "Get a batch of shots at Amazon A+ resolution. Relight, recompose, or regenerate any frame.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-[var(--color-ink)]">
      <div className="grid grid-cols-1 border-b border-[var(--color-line)] md:grid-cols-[240px_1fr]">
        <div className="border-b border-[var(--color-line)] px-6 py-8 md:border-r md:border-b-0 md:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            PROCESS &middot; N&deg;03
          </p>
        </div>
        <div className="px-6 py-8 md:px-12">
          <h2 className="font-serif text-5xl font-light leading-[1.02] tracking-tight text-[var(--color-ink)] md:text-[72px]">
            Three steps.
            <br />
            <span className="italic">No studio.</span>
          </h2>
        </div>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.n}
            className={`px-6 py-12 md:px-10 md:py-14 ${
              i < STEPS.length - 1
                ? "border-b border-[var(--color-line)] md:border-r md:border-b-0"
                : ""
            }`}
          >
            <div className="mb-7 font-serif text-7xl font-light italic leading-none text-[var(--color-ember)]">
              {step.n}.
            </div>
            <h3 className="mb-4 font-serif text-3xl font-normal text-[var(--color-ink)]">
              {step.title}
            </h3>
            <p className="font-serif text-lg font-light leading-relaxed text-[var(--color-ink-2)]">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
