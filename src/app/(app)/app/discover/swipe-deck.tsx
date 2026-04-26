/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SceneifyPreset } from "@/lib/sceneify/types";

type Direction = "left" | "right";
type HistoryEntry = { id: string; dir: Direction };
type Phase = "swipe" | "review";

const EXIT_MS = 280;
const SWIPE_THRESHOLD = 110;

export function SwipeDeck({ presets }: { presets: SceneifyPreset[] }) {
  const router = useRouter();
  const presetIndex = useMemo(() => {
    const map = new Map<string, { preset: SceneifyPreset; position: number }>();
    presets.forEach((p, i) => map.set(p.id, { preset: p, position: i }));
    return map;
  }, [presets]);

  const allIds = useMemo(() => presets.map((p) => p.id), [presets]);

  const [deck, setDeck] = useState<string[]>(allIds);
  const [liked, setLiked] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exiting, setExiting] = useState<{ id: string; dir: Direction } | null>(
    null,
  );
  const [phase, setPhase] = useState<Phase>("swipe");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const startRef = useRef({ x: 0, y: 0 });

  const topId = deck[0];
  const next1Id = deck[1];
  const next2Id = deck[2];

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
      const last = h[h.length - 1];
      setDeck((d) => [last.id, ...d]);
      if (last.dir === "right")
        setLiked((l) => l.filter((x) => x !== last.id));
      else setSkipped((s) => s.filter((x) => x !== last.id));
      return h.slice(0, -1);
    });
  }, []);

  // Auto-transition to review when deck empties
  useEffect(() => {
    if (deck.length === 0 && phase === "swipe" && !exiting) {
      const t = window.setTimeout(() => setPhase("review"), 400);
      return () => window.clearTimeout(t);
    }
  }, [deck.length, phase, exiting]);

  // Keyboard
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
    setPhase("swipe");
  };

  const reconsiderSkipped = () => {
    if (skipped.length === 0) return;
    setDeck(skipped);
    setSkipped([]);
    setHistory([]);
    setPhase("swipe");
  };

  const removeLiked = (id: string) =>
    setLiked((l) => l.filter((x) => x !== id));

  const continueToUpload = () => {
    if (liked.length === 0) return;
    router.push(`/app?presets=${liked.join(",")}`);
  };

  // ============================================================
  // REVIEW PHASE
  // ============================================================
  if (phase === "review") {
    const likedPresets = liked
      .map((id) => presetIndex.get(id)?.preset)
      .filter((p): p is SceneifyPreset => Boolean(p));

    return (
      <div className="space-y-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase mb-3">
              Your Moodboard · N°02
            </div>
            <h1 className="font-serif text-5xl md:text-6xl font-light leading-none">
              Your <em>aesthetic</em>.
            </h1>
            <p className="font-serif text-lg font-light text-[var(--color-ink-2)] mt-3 max-w-xl leading-snug">
              {likedPresets.length === 0 ? (
                "You skipped everything. Try again with something — anything — that catches your eye."
              ) : (
                <>
                  You picked <strong>{likedPresets.length}</strong>{" "}
                  {likedPresets.length === 1 ? "look" : "looks"}. We&apos;ll use
                  them as your scene presets.
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] underline shrink-0"
          >
            ↺ Start over
          </button>
        </div>

        {likedPresets.length > 0 && (
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase mb-3">
              Liked · {likedPresets.length}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {likedPresets.map((p) => {
                const pos = (presetIndex.get(p.id)?.position ?? 0) + 1;
                const hero = p.referenceImageUrls[0];
                return (
                  <div key={p.id} className="space-y-2">
                    <div className="relative aspect-[4/5] overflow-hidden border border-[var(--color-line)] bg-[var(--color-paper-2)]">
                      {hero ? (
                        <img
                          src={hero}
                          alt={p.name}
                          loading="lazy"
                          className="w-full h-full object-cover block"
                        />
                      ) : null}
                      <div className="absolute top-2 left-2 font-mono text-[9px] tracking-[0.12em] text-[var(--color-cream)] bg-black/65 px-1.5 py-0.5">
                        REF_{String(pos).padStart(3, "0")}
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${p.name}`}
                        onClick={() => removeLiked(p.id)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--color-cream)]/90 hover:bg-[var(--color-cream)] flex items-center justify-center text-[var(--color-ink)] text-xs leading-none cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="font-serif text-base italic">{p.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-[var(--color-ink)] text-[var(--color-cream)] px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-ink-4)] mb-1 uppercase">
              Next · Upload your product
            </div>
            <div className="font-serif text-xl md:text-2xl italic">
              {likedPresets.length > 0
                ? "Now let's see what you're selling."
                : "Pick at least one look to continue."}
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={reconsiderSkipped}
              disabled={skipped.length === 0}
              className="font-mono text-[11px] tracking-[0.12em] uppercase border border-[var(--color-ink-3)] text-[var(--color-cream)] px-4 py-2.5 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reconsider {skipped.length} skipped
            </button>
            <button
              type="button"
              onClick={continueToUpload}
              disabled={likedPresets.length === 0}
              className="font-mono text-[11px] tracking-[0.12em] uppercase bg-[var(--color-ember)] text-[var(--color-cream)] px-5 py-2.5 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue → upload →
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

  function topCardStyle(): React.CSSProperties {
    if (exiting) {
      const dx = exiting.dir === "right" ? 800 : -800;
      const dr = exiting.dir === "right" ? 28 : -28;
      return {
        transform: `translate(${dx}px, -40px) rotate(${dr}deg)`,
        opacity: 0,
        transition:
          "transform 0.28s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.28s",
      };
    }
    return {
      transform: `translate(${drag.x}px, ${drag.y * 0.4}px) rotate(${dragRot}deg)`,
      transition: drag.active
        ? "none"
        : "transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)",
      cursor: drag.active ? "grabbing" : "grab",
    };
  }

  function backCardStyle(offset: number): React.CSSProperties {
    const scale = 1 - offset * 0.04;
    const ty = offset * 14;
    return {
      transform: `translateY(${ty}px) scale(${scale})`,
      transition: "transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)",
      pointerEvents: "none",
    };
  }

  const cards: Array<{ id: string; offset: number; isTop: boolean }> = [];
  if (next2Id) cards.push({ id: next2Id, offset: 2, isTop: false });
  if (next1Id) cards.push({ id: next1Id, offset: 1, isTop: false });
  if (topId) cards.push({ id: topId, offset: 0, isTop: true });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase mb-3">
            Style Discovery · N°01
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-light leading-none">
            Train your <em>eye</em>.
          </h1>
          <p className="font-serif text-base md:text-lg font-light text-[var(--color-ink-2)] mt-2">
            Swipe right on looks you&apos;d buy. Skip what doesn&apos;t speak to
            you.
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase mb-1.5">
            Progress
          </div>
          <div className="font-serif text-3xl italic leading-none">
            {totalDecided}{" "}
            <span className="text-[var(--color-ink-3)]">/ {totalCards}</span>
          </div>
          <div className="mt-2 flex gap-3.5 justify-end font-mono text-[10px] tracking-[0.12em]">
            <span className="text-[var(--color-ember)]">
              ♥ {liked.length} LIKED
            </span>
            <span className="text-[var(--color-ink-3)]">
              ✕ {skipped.length} SKIPPED
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-1">
        {allIds.map((id, i) => (
          <div
            key={id}
            className="flex-1 h-0.5 transition-colors"
            style={{
              background:
                i < totalDecided
                  ? "var(--color-ember)"
                  : "var(--color-line)",
            }}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <div
          className="relative w-full max-w-[480px] aspect-[4/5] select-none"
          onMouseMove={(e) => onMove(e.clientX, e.clientY)}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchMove={(e) => {
            const t = e.touches[0];
            if (t) onMove(t.clientX, t.clientY);
          }}
          onTouchEnd={onUp}
        >
          {cards.map(({ id, offset, isTop }) => {
            const entry = presetIndex.get(id);
            if (!entry) return null;
            const { preset, position } = entry;
            const hero = preset.referenceImageUrls[0];
            const refLabel = `REF_${String(position + 1).padStart(3, "0")} · PRESET`;
            return (
              <div
                key={id + "-" + offset}
                onMouseDown={
                  isTop ? (e) => onDown(e.clientX, e.clientY) : undefined
                }
                onTouchStart={
                  isTop
                    ? (e) => {
                        const t = e.touches[0];
                        if (t) onDown(t.clientX, t.clientY);
                      }
                    : undefined
                }
                className="absolute inset-0 bg-[var(--color-cream)] border border-[var(--color-line)] overflow-hidden"
                style={{
                  boxShadow: isTop
                    ? "0 12px 40px rgba(27,25,21,0.18)"
                    : "0 6px 20px rgba(27,25,21,0.08)",
                  ...(isTop ? topCardStyle() : backCardStyle(offset)),
                }}
              >
                {hero ? (
                  <img
                    src={hero}
                    alt={preset.name}
                    draggable={false}
                    className="w-full h-full object-cover block pointer-events-none"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--color-paper-2)]" />
                )}

                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(27,25,21,0.78) 100%)",
                  }}
                />

                <div className="absolute top-3.5 left-3.5 font-mono text-[10px] tracking-[0.14em] text-[var(--color-cream)] bg-black/55 px-2.5 py-1 backdrop-blur-sm">
                  {refLabel}
                </div>

                <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-5 text-[var(--color-cream)]">
                  <div className="font-serif text-3xl md:text-4xl italic font-light leading-none">
                    {preset.name}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.12em] mt-2 opacity-85 uppercase">
                    {preset.description ?? "Preset reference"}
                  </div>
                </div>

                {isTop && (
                  <>
                    <div
                      className="absolute top-8 left-6 px-3.5 py-2 border-[3px] border-[var(--color-ember)] text-[var(--color-ember)] font-mono text-xl tracking-[0.18em] font-bold pointer-events-none"
                      style={{
                        transform: "rotate(-12deg)",
                        opacity:
                          drag.x > 30
                            ? Math.min(1, drag.x / SWIPE_THRESHOLD)
                            : 0,
                        transition: drag.active ? "none" : "opacity 0.15s",
                        background: "rgba(250,247,240,0.85)",
                      }}
                    >
                      LIKE
                    </div>
                    <div
                      className="absolute top-8 right-6 px-3.5 py-2 border-[3px] border-[var(--color-ink)] text-[var(--color-ink)] font-mono text-xl tracking-[0.18em] font-bold pointer-events-none"
                      style={{
                        transform: "rotate(12deg)",
                        opacity:
                          drag.x < -30
                            ? Math.min(1, -drag.x / SWIPE_THRESHOLD)
                            : 0,
                        transition: drag.active ? "none" : "opacity 0.15s",
                        background: "rgba(250,247,240,0.85)",
                      }}
                    >
                      NOPE
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {!topId && !exiting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--color-ink-3)]">
              <div className="font-serif text-3xl italic">
                That&apos;s everything.
              </div>
              <div className="font-mono text-[11px] tracking-[0.12em] uppercase">
                Building your moodboard…
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-5 pt-4 pb-2">
        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0}
          title="Undo"
          aria-label="Undo"
          className="w-12 h-12 rounded-full bg-[var(--color-cream)] border border-[var(--color-line)] text-[var(--color-ink-2)] text-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--color-ink-3)]"
        >
          ↺
        </button>
        <button
          type="button"
          onClick={() => decide("left")}
          disabled={!topId || !!exiting}
          title="Skip"
          aria-label="Skip"
          className="w-16 h-16 rounded-full bg-[var(--color-cream)] border-2 border-[var(--color-ink)] text-[var(--color-ink)] text-2xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 transition-transform"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => decide("right")}
          disabled={!topId || !!exiting}
          title="Like"
          aria-label="Like"
          className="w-16 h-16 rounded-full bg-[var(--color-ember)] border-2 border-[var(--color-ember)] text-[var(--color-cream)] text-2xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 transition-transform"
        >
          ♥
        </button>
        <button
          type="button"
          onClick={() => setPhase("review")}
          disabled={liked.length === 0}
          title="Done — review moodboard"
          className="w-12 h-12 rounded-full bg-[var(--color-ink)] text-[var(--color-cream)] font-mono text-[10px] tracking-[0.1em] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        >
          DONE
        </button>
      </div>

      <div className="text-center">
        <Link
          href="/app"
          className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] underline"
        >
          Cancel and go back
        </Link>
      </div>
    </div>
  );
}
