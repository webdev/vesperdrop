type Item = {
  id: string;
  token: string;
  title: string;
  viewCount: number;
  ctaClickCount: number;
  signupCount: number;
};

export function TopPreviews({ items }: { items: Item[] }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Top performing previews — {items.length}
      </p>
    </div>
  );
}
