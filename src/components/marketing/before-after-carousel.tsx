"use client";

import Image from "next/image";
import { useState, useRef, useCallback } from "react";
import { ChevronsLeftRight } from "lucide-react";

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

const DEFAULT_SPLIT = 50;
const KEY_STEP = 5;

export function BeforeAfterCarousel() {
  const [index, setIndex] = useState(0);
  // Per-slide split position. splitPct = % from the left edge where the seam
  // sits. After is the top layer, clipped to the right of the seam
  // (clip-path inset 0 0 0 splitPct%) so the Before peeks through on the left.
  // Default 50 → 50/50 split. Per VES-33 TC-3.8: split resets to 50 on slide
  // change (each slide has its own entry; absent → DEFAULT_SPLIT).
  const [splitMap, setSplitMap] = useState<Record<number, number>>({});

  const pair = PAIRS[index];
  const splitPct = splitMap[index] ?? DEFAULT_SPLIT;

  const setSplit = useCallback(
    (pairIndex: number, next: number | ((current: number) => number)) => {
      setSplitMap((prev) => {
        const current = prev[pairIndex] ?? DEFAULT_SPLIT;
        const resolved = typeof next === "function" ? next(current) : next;
        return {
          ...prev,
          [pairIndex]: Math.max(0, Math.min(100, resolved)),
        };
      });
    },
    [],
  );

  return (
    <div className="flex flex-col items-center gap-4 md:gap-6">
      <figure className="w-full max-w-4xl">
        {/* Desktop: side-by-side (unchanged from original) */}
        {/* Note: `priority` is intentionally OFF for the desktop variants —
            Lighthouse measures mobile, and Next/Image preloads all
            priority images regardless of CSS visibility, so giving the
            desktop pair priority on a mobile viewport just steals
            bandwidth from the actual LCP candidate (mobile After). */}
        <div className="hidden md:grid md:grid-cols-2 md:gap-5">
          <BeforeAfterCard
            kind="before"
            src={pair.before}
            alt={`${pair.label} — flat lay before Vesperdrop`}
            label="Before"
          />
          <BeforeAfterCard
            kind="after"
            src={pair.after}
            alt={`${pair.label} — on-model lifestyle photo, ${pair.scene.toLowerCase()}`}
            label="After"
          />
        </div>

        {/* Mobile: persistent split-slider */}
        <div className="md:hidden" data-testid="mobile-card">
          <SplitSliderCard
            pair={pair}
            pairIndex={index}
            splitPct={splitPct}
            onSplitChange={(next) => setSplit(index, next)}
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
            className="flex h-11 min-w-11 items-center justify-center p-3"
          >
            <span
              aria-hidden
              className={`block h-2 rounded-full transition-all ${
                i === index ? "w-8 bg-ink" : "w-2 bg-ink-4"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

type SplitSliderCardProps = {
  pair: Pair;
  pairIndex: number;
  splitPct: number;
  onSplitChange: (next: number | ((current: number) => number)) => void;
};

function SplitSliderCard({
  pair,
  pairIndex,
  splitPct,
  onSplitChange,
}: SplitSliderCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      onSplitChange(pct);
    },
    [onSplitChange],
  );

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        onSplitChange((cur) => cur - KEY_STEP);
        break;
      case "ArrowRight":
        e.preventDefault();
        onSplitChange((cur) => cur + KEY_STEP);
        break;
      case "Home":
        e.preventDefault();
        onSplitChange(0);
        break;
      case "End":
        e.preventDefault();
        onSplitChange(100);
        break;
    }
  }

  // After is the top layer; clip its left side up to the seam so that
  // the Before underneath shows on the left.
  // inset(top right bottom left): inset(0 0 0 X%) hides the left X% of After.
  const afterClipStyle = {
    clipPath: `inset(0 0 0 ${splitPct}%)`,
  };

  const splitPctRounded = Math.round(splitPct);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={cardRef}
        data-testid="card-image-area"
        className="relative aspect-[4/5] w-full max-w-sm overflow-hidden rounded-lg border border-line-soft bg-paper-2 shadow-soft select-none"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Before — bottom layer. Both images mount on initial render because
            both halves are visible at rest (50/50). */}
        <Image
          src={pair.before}
          alt={`${pair.label} — flat lay before Vesperdrop`}
          fill
          loading={pairIndex === 0 ? "eager" : "lazy"}
          sizes="(min-width: 640px) 384px, calc(100vw - 40px)"
          quality={80}
          className="object-cover"
        />

        {/* After — top layer, clipped to reveal Before on the left of the seam.
            This is the mobile LCP candidate — give it explicit
            fetchPriority=high so the browser preload lands ahead of
            other resources. (VES-7.) */}
        <div
          className="absolute inset-0"
          style={afterClipStyle}
          aria-hidden={splitPct >= 100}
        >
          <Image
            src={pair.after}
            alt={`${pair.label} — on-model lifestyle photo, ${pair.scene.toLowerCase()}`}
            fill
            priority={pairIndex === 0}
            fetchPriority={pairIndex === 0 ? "high" : "auto"}
            sizes="(min-width: 640px) 384px, calc(100vw - 40px)"
            quality={85}
            className="object-cover"
          />
        </div>

        {/* VESPERDROP pill — top right, preserved */}
        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center rounded-full bg-ink/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cream backdrop-blur-sm">
          Vesperdrop
        </span>

        {/* RAW PRODUCT pill — bottom left, over Before */}
        <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-cream/95 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink shadow-subtle">
          Raw product
          <span aria-hidden className="text-ink-3">
            •
          </span>
        </span>

        {/* READY TO LIST pill — bottom right, over After */}
        <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cream shadow-subtle">
          Ready to list
          <span aria-hidden className="text-cream/70">
            •
          </span>
        </span>

        {/* Vertical seam — visual hairline at the split */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/80 mix-blend-overlay"
          style={{ left: `${splitPct}%`, transform: "translateX(-0.5px)" }}
        />

        {/* Drag handle — circular, sits on the seam, vertically centered */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare before and after"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={splitPctRounded}
          aria-orientation="horizontal"
          onKeyDown={handleKeyDown}
          data-testid="split-handle"
          className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-ink shadow-md ring-1 ring-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          style={{ left: `${splitPct}%` }}
        >
          <ChevronsLeftRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function BeforeAfterCard({
  kind,
  src,
  alt,
  label,
}: {
  kind: "before" | "after";
  src: string;
  alt: string;
  label: string;
}) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-line-soft bg-paper-2 shadow-soft">
      <Image
        src={src}
        alt={alt}
        fill
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
