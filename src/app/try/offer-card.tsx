"use client";

const ITEMS = [
  "2 high-resolution images",
  "Commercial use license",
  "No watermark",
  "Instant download",
];

export function OfferCard({ onUnlock }: { onUnlock: () => void }) {
  return (
    <aside
      data-testid="offer-card"
      className="relative flex flex-col gap-5 rounded-lg border border-paper-2 bg-surface p-6 shadow-sm md:gap-6"
    >
      <span className="inline-flex w-fit items-center rounded-full bg-terracotta-wash px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta-dark">
        Limited offer
      </span>

      <h2 className="font-serif text-[clamp(1.5rem,2vw,1.75rem)] leading-[1.1] tracking-[-0.01em] text-ink">
        Unlock 2 high-res images for just{" "}
        <span className="text-terracotta-dark">$9.99</span>
      </h2>

      <ul className="flex flex-col gap-2.5">
        {ITEMS.map((label) => (
          <li key={label} className="flex items-center gap-2.5 text-[14px] leading-[1.4] text-ink-2">
            <span
              aria-hidden
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-terracotta text-cream"
            >
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6.5l2.5 2.5 4.5-5" />
              </svg>
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onUnlock}
        data-testid="offer-card-unlock"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.14em] text-cream transition-colors hover:bg-terracotta-dark"
      >
        Unlock now — $9.99 <span aria-hidden>→</span>
      </button>

      <p className="flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="4" y="11" width="16" height="10" rx="1.5" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Secure payment
      </p>
    </aside>
  );
}
