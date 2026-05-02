/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SceneifyPublicPreset } from "@/lib/sceneify/types";
import { Pill } from "@/components/ui/pill";
import { applyPicks } from "./actions";

type Direction = "left" | "right";
type HistoryEntry = { id: string; dir: Direction };
type Phase = "swipe" | "review";

const EXIT_MS = 280;
const SWIPE_THRESHOLD = 110;

function parsePhase(raw: string | null): Phase {
  return raw === "review" ? "review" : "swipe";
}

export function SwipeDeck({ presets }: { presets: SceneifyPublicPreset[] }) {
  const [continuing, startContinue] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const presetIndex = useMemo(() => {
    const map = new Map<string, { preset: SceneifyPublicPreset; position: number }>();
    presets.forEach((p, i) => map.set(p.slug, { preset: p, position: i }));
    return map;
  }, [presets]);

  const allIds = useMemo(() => presets.map((p) => p.slug), [presets]);

  const [deck, setDeck] = useState<string[]>(allIds);
  const [liked, setLiked] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exiting, setExiting] = useState<{ id: string; dir: Direction } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const urlPhase = parsePhase(searchParams.get("phase"));
  const effectivePhase: Phase =
    urlPhase === "review" && liked.length === 0 && skipped.length === 0
      ? "swipe"
      : urlPhase;
  const phase = effectivePhase;

  const goToPhase = useCallback(
    (next: Phase, mode: "push" | "replace" = "push") => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "swipe") params.delete("phase");
      else params.set("phase", next);
      const qs = params.toString();
      const href = qs ? `/discover?${qs}` : "/discover";
      if (mode === "replace") router.replace(href);
      else router.push(href);
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (urlPhase !== effectivePhase) {
      goToPhase(effectivePhase, "replace");
    }
  }, [urlPhase, effectivePhase, goToPhase]);

  const startRef = useRef({ x: 0, y: 0 });
  const topId = deck[0];

  const decide = useCallback(
    (dir: Direction) => {
      if (!topId || exiting) return;
      const id = topId;
      setExiting({ id, dir });
      setHistory((h) => [...h, { id, dir }]);
      window.setTimeout(() => {
        setDeck((d) => d.slice(1));
        if (dir === "right") setLiked((l) => [...l, id]);
        else setSkipped((s) => [...s, id]);
        setExiting(null);
        setDrag({ x: 0, y: 0, active: false });
      }, EXIT_MS);
    },
    [topId, exiting],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1]!;
      setDeck((d) => [last.id, ...d]);
      if (last.dir === "right") setLiked((l) => l.filter((x) => x !== last.id));
      else setSkipped((s) => s.filter((x) => x !== last.id));
      return h.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    if (
      deck.length === 0 &&
      phase === "swipe" &&
      !exiting &&
      (liked.length > 0 || skipped.length > 0)
    ) {
      const t = window.setTimeout(() => goToPhase("review", "replace"), 400);
      return () => window.clearTimeout(t);
    }
  }, [deck.length, phase, exiting, liked.length, skipped.length, goToPhase]);

  useEffect(() => {
    if (phase !== "swipe") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") decide("right");
      else if (e.key === "ArrowLeft") decide("left");
      else if (e.key === "ArrowUp") undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, decide, undo]);

  const onDown = (clientX: number, clientY: number) => {
    if (exiting) return;
    startRef.current = { x: clientX, y: clientY };
    setDrag({ x: 0, y: 0, active: true });
  };
  const onMove = (clientX: number, clientY: number) => {
    if (!drag.active) return;
    setDrag({
      x: clientX - startRef.current.x,
      y: clientY - startRef.current.y,
      active: true,
    });
  };
  const onUp = () => {
    if (!drag.active) return;
    if (drag.x > SWIPE_THRESHOLD) decide("right");
    else if (drag.x < -SWIPE_THRESHOLD) decide("left");
    else setDrag({ x: 0, y: 0, active: false });
  };

  const reset = () => {
    setDeck(allIds);
    setLiked([]);
    setSkipped([]);
    setHistory([]);
    goToPhase("swipe", "replace");
  };

  const reconsiderSkipped = () => {
    if (skipped.length === 0) return;
    setDeck(skipped);
    setSkipped([]);
    setHistory([]);
    goToPhase("swipe", "push");
  };

  const removeLiked = (id: string) =>
    setLiked((l) => l.filter((x) => x !== id));

  const continueToUpload = () => {
    if (liked.length === 0) return;
    startContinue(() => applyPicks(liked));
  };

  // ============================================================
  // REVIEW PHASE
  // ============================================================
  if (phase === "review") {
    const likedPresets = liked
      .map((id) => presetIndex.get(id)?.preset)
      .filter((p): p is SceneifyPublicPreset => Boolean(p));

    return (
      <div className="space-y-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              Your moodboard
            </p>
            <h1 className="mt-3 font-serif text-[clamp(2.5rem,5vw,3.75rem)] leading-[1.02] tracking-[-0.02em] text-ink">
              Your aesthetic.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-[1.6] text-ink-3">
              {likedPresets.length === 0
                ? "You skipped everything. Try again with something — anything — that catches your eye."
                : `You picked ${likedPresets.length} ${likedPresets.length === 1 ? "look" : "looks"}. We'll use them as your scene presets.`}
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="self-start font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 underline-offset-4 hover:text-ink hover:underline"
          >
            ↺ Start over
          </button>
        </div>

        {likedPresets.length > 0 ? (
          <div className="space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
              Liked · {likedPresets.length}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {likedPresets.map((p) => (
                <figure key={p.slug} className="space-y-2">
                  <div className="group relative aspect-[4/5] overflow-hidden rounded-md border border-line-soft bg-paper-2">
                    {p.heroImageUrl ? (
                      <img
                        src={p.heroImageUrl}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Remove ${p.name}`}
                      onClick={() => removeLiked(p.slug)}
                      className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-cream/95 text-ink shadow-subtle transition-colors hover:bg-cream"
                    >
                      <span aria-hidden>×</span>
                    </button>
                  </div>
                  <figcaption className="font-serif text-[16px] leading-[1.2] text-ink">
                    {p.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 rounded-lg bg-ink p-6 text-cream md:flex-row md:items-center md:justify-between md:p-7">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cream/60">
              Next · Upload your product
            </p>
            <p className="mt-2 font-serif text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.15] tracking-[-0.01em]">
              {likedPresets.length > 0
                ? "Now let's see what you're selling."
                : "Pick at least one look to continue."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={reconsiderSkipped}
              disabled={skipped.length === 0}
              className="font-mono text-[11px] uppercase tracking-[0.12em] rounded-full border border-cream/25 px-4 py-2.5 text-cream transition-colors hover:bg-cream/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reconsider {skipped.length} skipped
            </button>
            <button
              type="button"
              onClick={continueToUpload}
              disabled={likedPresets.length === 0 || continuing}
              className="font-mono text-[11px] uppercase tracking-[0.12em] rounded-full bg-terracotta px-5 py-2.5 text-cream transition-colors hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {continuing ? "Loading…" : "Continue → upload →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // SWIPE PHASE
  // ============================================================
  const dragRot = drag.x * 0.06;
  const totalDecided = liked.length + skipped.length;
  const totalCards = allIds.length;
  const progress = totalCards === 0 ? 0 : totalDecided / totalCards;

  // All cards share a base centered transform (`translate(-50%, -50%)`); per-
  // card transforms add to that. Drag/exit transforms layer on top of the
  // top card's base centering. Peeks are positioned side-by-side so the
  // composition reads as a row of cards across the full viewport.

  function topCardStyle(): React.CSSProperties {
    if (exiting) {
      const dx = exiting.dir === "right" ? 800 : -800;
      const dr = exiting.dir === "right" ? 28 : -28;
      return {
        transform: `translate(calc(-50% + ${dx}px), calc(-50% - 40px)) rotate(${dr}deg)`,
        opacity: 0,
        transition: "transform 0.28s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.28s",
      };
    }
    return {
      transform: `translate(calc(-50% + ${drag.x}px), calc(-50% + ${drag.y * 0.4}px)) rotate(${dragRot}deg)`,
      transition: drag.active
        ? "none"
        : "transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)",
      cursor: drag.active ? "grabbing" : "grab",
    };
  }

  function peekStyle(side: "left" | "right", index: number): React.CSSProperties {
    const dir = side === "left" ? -1 : 1;
    // Adjacent peek (index 1): sits ~105% off (just past center card), scaled
    // to 88% so it reads as a slightly recessed sibling.
    // Far peek (index 2): twice as far, smaller and more faded — clipped by
    // the wrapper's overflow-hidden on narrower viewports.
    const xPercent = index === 1 ? 105 : 210;
    const scale = index === 1 ? 0.88 : 0.72;
    const opacity = index === 1 ? 0.92 : 0.55;
    return {
      transform: `translate(calc(-50% + ${dir * xPercent}%), -50%) scale(${scale})`,
      opacity,
      transition: "transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.32s",
      pointerEvents: "none",
      zIndex: 10 - index,
    };
  }

  const next1Id = deck[1];
  const next2Id = deck[2];
  // Pull from the tail of the deck for left-side visual context.
  const tail1Id = deck.length > 3 ? deck[deck.length - 1] : undefined;
  const tail2Id = deck.length > 4 ? deck[deck.length - 2] : undefined;

  return (
    <div className="space-y-16 md:space-y-20">
      {/* Header */}
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="md:max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-terracotta">
            Discover styles
          </p>
          <h1 className="mt-6 font-serif text-[clamp(3.5rem,7vw,6rem)] leading-[0.96] tracking-[-0.02em] text-ink">
            Train your eye.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-[1.55] text-ink-3">
            Swipe right on looks you love.
            <br />
            Skip what doesn&apos;t speak to you.
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Progress
          </p>
          <p className="mt-3 font-serif text-[clamp(2.75rem,5vw,4.5rem)] leading-none tracking-[-0.02em] text-ink tabular-nums">
            {totalDecided}{" "}
            <span className="text-ink-4">/ {totalCards}</span>
          </p>
          <div className="mt-4 flex items-center justify-end gap-4 font-mono text-[10px] uppercase tracking-[0.12em]">
            <span className="text-terracotta">♥ {liked.length} liked</span>
            <span className="text-ink-4">✕ {skipped.length} skipped</span>
          </div>
        </div>
      </div>

      {/* Progress hairline */}
      <div className="h-px w-full overflow-hidden bg-line-soft">
        <div
          className="h-full bg-terracotta transition-[width] duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Deck — breaks out of the page container so cards span the viewport. */}
      <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen overflow-hidden">
        <div
          className="relative mx-auto h-[600px] select-none"
          onMouseMove={(e) => onMove(e.clientX, e.clientY)}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchMove={(e) => {
            const t = e.touches[0];
            if (t) onMove(t.clientX, t.clientY);
          }}
          onTouchEnd={onUp}
        >
          {/* Left peeks (visual context, drawn from tail of deck) */}
          {tail2Id ? (
            <PeekCard id={tail2Id} presetIndex={presetIndex} style={peekStyle("left", 2)} />
          ) : null}
          {tail1Id ? (
            <PeekCard id={tail1Id} presetIndex={presetIndex} style={peekStyle("left", 1)} />
          ) : null}

          {/* Right peeks (upcoming cards) */}
          {next2Id ? (
            <PeekCard id={next2Id} presetIndex={presetIndex} style={peekStyle("right", 2)} />
          ) : null}
          {next1Id ? (
            <PeekCard id={next1Id} presetIndex={presetIndex} style={peekStyle("right", 1)} />
          ) : null}

          {/* Top (interactive) card */}
          {topId ? (
            <TopCard
              id={topId}
              presetIndex={presetIndex}
              style={topCardStyle()}
              dragX={drag.x}
              dragActive={drag.active}
              onMouseDown={(e) => onDown(e.clientX, e.clientY)}
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (t) onDown(t.clientX, t.clientY);
              }}
            />
          ) : null}

          {!topId && !exiting ? (
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-ink-3">
              <p className="font-serif text-[clamp(1.5rem,2.5vw,2rem)] leading-tight tracking-tight">
                That&apos;s everything.
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em]">
                Building your moodboard…
              </p>
            </div>
          ) : null}

          {/* Viewport-edge arrow controls */}
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            aria-label="Previous"
            title="Previous"
            className="absolute left-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-cream text-ink shadow-card transition-colors hover:bg-paper-soft disabled:cursor-not-allowed disabled:opacity-40 md:left-10"
          >
            <span aria-hidden className="text-lg">←</span>
          </button>
          <button
            type="button"
            onClick={() => decide("left")}
            disabled={!topId || !!exiting}
            aria-label="Next"
            title="Next"
            className="absolute right-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-cream text-ink shadow-card transition-colors hover:bg-paper-soft disabled:cursor-not-allowed disabled:opacity-40 md:right-10"
          >
            <span aria-hidden className="text-lg">→</span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 pt-2 md:gap-7">
        <button
          type="button"
          onClick={() => decide("left")}
          disabled={!topId || !!exiting}
          className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => decide("left")}
          disabled={!topId || !!exiting}
          aria-label="Skip"
          title="Skip"
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-ink bg-cream text-ink transition-colors hover:bg-paper-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden className="text-xl">×</span>
        </button>
        <button
          type="button"
          onClick={() => decide("right")}
          disabled={!topId || !!exiting}
          aria-label="Like"
          title="Like"
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-cream shadow-subtle transition-colors hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden className="text-xl">♥</span>
        </button>
        <button
          type="button"
          onClick={() => decide("right")}
          disabled={!topId || !!exiting}
          className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink transition-colors hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-40"
        >
          Looks good
        </button>
      </div>

      {liked.length > 0 ? (
        <div className="text-center">
          <button
            type="button"
            onClick={() => goToPhase("review", "push")}
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Done · Review {liked.length} pick{liked.length === 1 ? "" : "s"} →
          </button>
        </div>
      ) : null}

      <div className="mx-auto max-w-md space-y-1 text-center text-[14px] leading-[1.55] text-ink-3">
        <p>Try all styles. Generate with your favorite.</p>
        <p>
          You can generate{" "}
          <strong className="font-medium text-terracotta">1 style</strong>{" "}
          for free.
        </p>
      </div>
    </div>
  );
}

function PeekCard({
  id,
  presetIndex,
  style,
}: {
  id: string;
  presetIndex: Map<string, { preset: SceneifyPublicPreset; position: number }>;
  style: React.CSSProperties;
}) {
  const entry = presetIndex.get(id);
  if (!entry) return null;
  const { preset } = entry;
  return (
    <div
      className="absolute left-1/2 top-1/2 aspect-[3/4] w-[400px] max-w-[88vw] overflow-hidden rounded-2xl border border-line-soft bg-paper-2 shadow-card"
      style={style}
    >
      {preset.heroImageUrl ? (
        <img
          src={preset.heroImageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none h-full w-full object-cover"
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(24,22,20,0.7) 100%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-10 text-cream">
        <h3 className="font-serif text-[clamp(1.25rem,1.6vw,1.625rem)] leading-[1.05] tracking-[-0.01em]">
          {preset.name}
        </h3>
        {preset.description ? (
          <p className="mt-1.5 truncate font-mono text-[9px] uppercase tracking-[0.16em] text-cream/85">
            {preset.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TopCard({
  id,
  presetIndex,
  style,
  dragX,
  dragActive,
  onMouseDown,
  onTouchStart,
}: {
  id: string;
  presetIndex: Map<string, { preset: SceneifyPublicPreset; position: number }>;
  style: React.CSSProperties;
  dragX: number;
  dragActive: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}) {
  const entry = presetIndex.get(id);
  if (!entry) return null;
  const { preset } = entry;

  const likeOpacity =
    dragX > 30 ? Math.min(1, dragX / SWIPE_THRESHOLD) : 0;
  const skipOpacity =
    dragX < -30 ? Math.min(1, -dragX / SWIPE_THRESHOLD) : 0;

  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className="absolute left-1/2 top-1/2 z-30 aspect-[3/4] w-[400px] max-w-[88vw] overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-soft"
      style={style}
    >
      {preset.heroImageUrl ? (
        <img
          src={preset.heroImageUrl}
          alt={preset.name}
          draggable={false}
          className="pointer-events-none block h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full bg-paper-2" />
      )}

      {/* Bottom gradient + caption */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(24,22,20,0.85) 100%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 px-6 pb-7 pt-12 text-cream">
        <h2 className="font-serif text-[clamp(2rem,3.5vw,2.75rem)] leading-[1.02] tracking-[-0.02em]">
          {preset.name}
        </h2>
        {preset.description ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cream/85">
            {preset.description}
          </p>
        ) : null}
      </div>

      {/* Like / Skip overlays */}
      <div
        className="pointer-events-none absolute left-6 top-8 rounded-md border-2 border-terracotta bg-cream/90 px-3 py-1.5 font-mono text-base uppercase tracking-[0.16em] text-terracotta"
        style={{
          transform: "rotate(-12deg)",
          opacity: likeOpacity,
          transition: dragActive ? "none" : "opacity 0.15s",
        }}
      >
        Like
      </div>
      <div
        className="pointer-events-none absolute right-6 top-8 rounded-md border-2 border-ink bg-cream/90 px-3 py-1.5 font-mono text-base uppercase tracking-[0.16em] text-ink"
        style={{
          transform: "rotate(12deg)",
          opacity: skipOpacity,
          transition: dragActive ? "none" : "opacity 0.15s",
        }}
      >
        Nope
      </div>

      {/* REFERENCE badge — always visible, fades during drag for legibility */}
      <Pill
        tone="ink"
        className="absolute right-4 top-4 border-cream/15 bg-ink/55 tracking-[0.16em] text-cream/95 backdrop-blur"
        style={{
          opacity: Math.abs(dragX) > 30 ? 0.4 : 1,
          transition: dragActive ? "none" : "opacity 0.15s",
        }}
      >
        Reference
      </Pill>
    </div>
  );
}
