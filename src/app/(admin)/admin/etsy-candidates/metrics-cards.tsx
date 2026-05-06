export function MetricsCards({
  metrics,
}: {
  metrics: { previewCount: number; viewSum: number; ctaClickSum: number; signupSum: number };
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Recent performance — {metrics.previewCount} previews
      </p>
    </div>
  );
}
