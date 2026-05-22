"use client";

import Image from "next/image";
import { useState, useRef } from "react";

type Pair = {
  slug: string;
  label: string;
  scene: string;
  before: string;
  after: string;
};

const PAIRS: Pair[] = [
  {
    slug: "cami",
    label: "Cami",
    scene: "Velvet glow",
    before: "/marketing/before-after/cami_before.webp",
    after: "/marketing/before-after/cami_after.webp",
  },
  {
    slug: "jacket",
    label: "Jacket",
    scene: "Urban canvas",
    before: "/marketing/before-after/jacket_before.webp",
    after: "/marketing/before-after/jacket_after.webp",
  },
  {
    slug: "skirt",
    label: "Skirt",
    scene: "Warm retreat",
    before: "/marketing/before-after/skirt_before.webp",
    after: "/marketing/before-after/skirt_after.webp",
  },
  {
    slug: "lace",
    label: "Lace",
    scene: "Studio athletic",
    before: "/marketing/before-after/lace_before.webp",
    after: "/marketing/before-after/lace_after.webp",
  },
];

export function BeforeAfterCarousel() {
  const [index, setIndex] = useState(0);
  // Per-slide before/after state — key is pair index, default false (After)
  const [showBeforeMap, setShowBeforeMap] = useState<Record<number, boolean>>(
    {},
  );
  const [hintDismissed, setHintDismissed] = useState(false);

  const pair = PAIRS[index];
  const showBefore = showBeforeMap[index] ?? false;

  function toggleBefore() {
    setShowBeforeMap((prev) => ({ ...prev, [index]: !(prev[index] ?? false) }));
    if (!hintDismissed) setHintDismissed(true);
  }

  return (
    <div className="flex flex-col items-center gap-4 md:gap-6">
      <figure className="w-full max-w-4xl">
        {/* Desktop: side-by-side (unchanged from original) */}
        <div className="hidden md:grid md:grid-cols-2 md:gap-5">
          <BeforeAfterCard
            kind="before"
            src={pair.before}
            alt={`${pair.label} — flat lay before Vesperdrop`}
            label="Before"
            priority={index === 0}
          />
          <BeforeAfterCard
            kind="after"
            src={pair.after}
            alt={`${pair.label} — on-model lifestyle photo, ${pair.scene.toLowerCase()}`}
            label="After"
            priority={index === 0}
          />
        </div>

        {/* Mobile: single card with toggle */}
        <div className="md:hidden" data-testid="mobile-card">
          <SingleCardToggle
            pair={pair}
            pairIndex={index}
            showBefore={showBefore}
            onToggle={toggleBefore}
            showHint={!hintDismissed}
          />
        </div>

        <figcaption className="mt-3 flex items-baseline justify-between gap-3 md:mt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
            {pair.label} · {pair.scene}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
            {index + 1} / {PAIRS.length}
          </p>
        </figcaption>
      </figure>

      <div
        className="flex items-center gap-2"
        role="tablist"
        aria-label="Before and after examples"
      >
        {PAIRS.map((p, i) => (
          <button
            key={p.slug}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show ${p.label} example`}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-8 bg-ink" : "w-2 bg-ink-4 hover:bg-ink-3"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

type SingleCardToggleProps = {
  pair: Pair;
  pairIndex: number;
  showBefore: boolean;
  onToggle: () => void;
  showHint: boolean;
};

function SingleCardToggle({
  pair,
  pairIndex,
  showBefore,
  onToggle,
  showHint,
}: SingleCardToggleProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragPct, setDragPct] = useState<number | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!cardRef.current || !(e.buttons & 1)) return;
    const rect = cardRef.current.getBoundingClientRect();
    const pct = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
    );
    setDragPct(pct);
  }

  function handlePointerUp() {
    if (dragPct !== null) {
      // Snap: drag left of center → Before, drag right of center → After
      const shouldShowBefore = dragPct < 50;
      if (shouldShowBefore !== showBefore) onToggle();
      setDragPct(null);
    }
  }

  // After image is on top; clip-path inset(0 0 0 X%) hides the left X% of After.
  // showBefore=true → clip 100% (entire After hidden, Before visible)
  // showBefore=false → clip 0% (entire After visible)
  const afterClipLeft = dragPct !== null ? 100 - dragPct : showBefore ? 100 : 0;

  const isAfterActive = !showBefore;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={cardRef}
        className="relative aspect-[4/5] w-full max-w-sm overflow-hidden rounded-lg border border-line-soft bg-paper-2 shadow-soft"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Before — bottom layer */}
        <Image
          src={pair.before}
          alt={`${pair.label} — flat lay before Vesperdrop`}
          fill
          priority={pairIndex === 0 && showBefore}
          sizes="(min-width: 640px) 384px, calc(100vw - 40px)"
          quality={80}
          className="object-cover"
        />

        {/* After — top layer, clipped to reveal Before underneath */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: `inset(0 0 0 ${afterClipLeft}%)`,
            transition: dragPct !== null ? "none" : "clip-path 0.2s ease",
          }}
        >
          <Image
            src={pair.after}
            alt={`${pair.label} — on-model lifestyle photo, ${pair.scene.toLowerCase()}`}
            fill
            priority={pairIndex === 0}
            sizes="(min-width: 640px) 384px, calc(100vw - 40px)"
            quality={85}
            className="object-cover"
          />
          <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-ink/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cream backdrop-blur-sm">
            Vesperdrop
          </span>
        </div>

        {/* Before label — only when Before is showing */}
        {showBefore ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center rounded-full bg-cream/95 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink shadow-subtle">
            Before
          </span>
        ) : null}

        {/* "Tap to compare" hint — fades after first toggle */}
        <div
          data-testid="compare-hint"
          className={`pointer-events-none absolute bottom-12 left-0 right-0 flex justify-center transition-opacity duration-500 ${
            showHint ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="rounded-full bg-black/50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            Tap to compare
          </span>
        </div>
      </div>

      {/* After / Before toggle pill */}
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
        <button
          type="button"
          aria-label="Show after"
          aria-pressed={isAfterActive}
          onClick={() => {
            if (!isAfterActive) onToggle();
          }}
          className={`rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all ${
            isAfterActive ? "bg-ink text-cream" : "text-ink-3 hover:text-ink"
          }`}
        >
          After
        </button>
        <button
          type="button"
          aria-label="Show before"
          aria-pressed={showBefore}
          onClick={() => {
            if (!showBefore) onToggle();
          }}
          className={`rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all ${
            showBefore ? "bg-ink text-cream" : "text-ink-3 hover:text-ink"
          }`}
        >
          Before
        </button>
      </div>
    </div>
  );
}

function BeforeAfterCard({
  kind,
  src,
  alt,
  label,
  priority,
}: {
  kind: "before" | "after";
  src: string;
  alt: string;
  label: string;
  priority?: boolean;
}) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-line-soft bg-paper-2 shadow-soft">
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 480px, (min-width: 640px) 45vw, 50vw"
        quality={kind === "after" ? 85 : 80}
        className="object-cover"
      />
      <span className="absolute bottom-3 left-3 inline-flex items-center rounded-full bg-cream/95 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink shadow-subtle">
        {label}
      </span>
      {kind === "after" ? (
        <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-ink/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cream backdrop-blur-sm">
          Vesperdrop
        </span>
      ) : null}
    </div>
  );
}
