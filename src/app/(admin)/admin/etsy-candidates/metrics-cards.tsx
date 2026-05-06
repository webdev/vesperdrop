type Metrics = {
  previewCount: number;
  viewSum: number;
  ctaClickSum: number;
  signupSum: number;
};

function rate(num: number, den: number): string {
  if (den === 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </p>
      <p className="mt-1 font-serif text-[28px] tracking-[-0.01em] text-ink">
        {value}
      </p>
    </div>
  );
}

export function MetricsCards({ metrics }: { metrics: Metrics }) {
  return (
    <section className="rounded-2xl border border-line-soft bg-surface p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        Recent performance
      </p>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <Tile label="Previews" value={metrics.previewCount} />
        <Tile label="Views" value={metrics.viewSum} />
        <Tile label="CTA clicks" value={metrics.ctaClickSum} />
        <Tile
          label="Conversion rate"
          value={rate(metrics.signupSum, metrics.viewSum)}
        />
      </div>
    </section>
  );
}
