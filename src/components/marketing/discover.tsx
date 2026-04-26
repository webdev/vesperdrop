/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Scene = {
  slug: string;
  name: string;
  mood: string;
  category: string;
  palette: string[];
};

const SCENES: Scene[] = [
  {
    slug: "studio_athletic",
    name: "Studio Athletic",
    mood: "STUDIO · SOFT STROBE",
    category: "STUDIO",
    palette: ["#f4f0e8", "#c2a37a", "#8a6f4d", "#3d3025", "#1b1915"],
  },
  {
    slug: "leather_noir",
    name: "Leather Noir",
    mood: "INTERIOR · LOW KEY TUNGSTEN",
    category: "INTERIOR",
    palette: ["#2a2018", "#5d4632", "#a87b4f", "#d6b380", "#1b1915"],
  },
  {
    slug: "graffiti_alley",
    name: "Graffiti Alley",
    mood: "ALLEY · BOUNCED DAYLIGHT",
    category: "STREET",
    palette: ["#3a4d4a", "#7e8a6e", "#c2a047", "#d65f3f", "#1f1f1d"],
  },
  {
    slug: "mono_street",
    name: "Mono Street",
    mood: "STREET · OVERCAST CONCRETE",
    category: "STREET",
    palette: ["#cfcdc8", "#9a958d", "#5e5a52", "#2f2c27", "#1b1915"],
  },
  {
    slug: "shutter_crew",
    name: "Shutter Crew",
    mood: "ROLLUP DOORS · MORNING SUN",
    category: "EXTERIOR",
    palette: ["#e8d8b6", "#c79755", "#6f4a2a", "#392418", "#0f0c08"],
  },
];

type Direction = "left" | "right";
const EXIT_MS = 280;
const SWIPE_THRESHOLD = 110;

const SCENE_BY_SLUG: Record<string, Scene> = SCENES.reduce(
  (acc, s) => ({ ...acc, [s.slug]: s }),
  {} as Record<string, Scene>,
);
const SCENE_INDEX: Record<string, number> = SCENES.reduce(
  (acc, s, i) => ({ ...acc, [s.slug]: i }),
  {} as Record<string, number>,
);

export function Discover() {
  const allSlugs = SCENES.map((s) => s.slug);
  const [deck, setDeck] = useState<string[]>(allSlugs);
  const [liked, setLiked] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [history, setHistory] = useState<{ slug: string; dir: Direction }[]>([]);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exiting, setExiting] = useState<{ slug: string; dir: Direction } | null>(
    null,
  );
  const startRef = useRef({ x: 0, y: 0 });
  const sectionRef = useRef<HTMLElement | null>(null);
  const inViewRef = useRef(false);

  const topSlug = deck[0];
  const next1Slug = deck[1];
  const next2Slug = deck[2];

  const decide = useCallback(
    (dir: Direction) => {
      if (!topSlug || exiting) return;
      const slug = topSlug;
      setExiting({ slug, dir });
      setHistory((h) => [...h, { slug, dir }]);
      window.setTimeout(() => {
        setDeck((d) => d.slice(1));
        if (dir === "right") setLiked((l) => [...l, slug]);
        else setSkipped((s) => [...s, slug]);
        setExiting(null);
        setDrag({ x: 0, y: 0, active: false });
      }, EXIT_MS);
    },
    [topSlug, exiting],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setDeck((d) => [last.slug, ...d]);
      if (last.dir === "right") setLiked((l) => l.filter((x) => x !== last.slug));
      else setSkipped((s) => s.filter((x) => x !== last.slug));
      return h.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => {
    setDeck(allSlugs);
    setLiked([]);
    setSkipped([]);
    setHistory([]);
  }, [allSlugs]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) inViewRef.current = e.isIntersecting;
      },
      { threshold: 0.4 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!inViewRef.current) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        decide("right");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        decide("left");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, undo]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (exiting || !topSlug) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.active) return;
    setDrag({
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
      active: true,
    });
  }
  function onPointerUp() {
    if (!drag.active) return;
    if (drag.x > SWIPE_THRESHOLD) decide("right");
    else if (drag.x < -SWIPE_THRESHOLD) decide("left");
    else setDrag({ x: 0, y: 0, active: false });
  }

  const totalDecided = liked.length + skipped.length;
  const empty = deck.length === 0;

  return (
    <section
      id="discover"
      ref={sectionRef}
      className="border-b border-[var(--color-ink)]"
    >
      <div className="grid grid-cols-1 border-b border-[var(--color-line)] md:grid-cols-[240px_1fr]">
        <div className="border-b border-[var(--color-line)] px-6 py-8 md:border-r md:border-b-0 md:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            STYLE DISCOVERY &middot; N&deg;02&middot;5
          </p>
        </div>
        <div className="px-6 py-8 md:px-12">
          <h2 className="font-serif text-5xl font-light leading-[1.02] tracking-tight text-[var(--color-ink)] md:text-[72px]">
            Train your <span className="italic">eye</span>.
          </h2>
          <p className="mt-4 max-w-xl font-serif text-lg font-light leading-snug text-[var(--color-ink-2)]">
            Swipe the looks you&apos;d buy. Skip what doesn&apos;t speak to you.
            We blend the lighting, palette, and mood into every shot.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-[1fr_440px] md:gap-16 md:px-12 md:py-24">
        <div className="order-2 md:order-1">
          <div className="mb-6 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
              YOUR DECK
            </p>
            <p className="font-serif text-2xl italic text-[var(--color-ink)]">
              {totalDecided}{" "}
              <span className="text-[var(--color-ink-3)]">
                / {SCENES.length}
              </span>
            </p>
          </div>

          <div className="mb-8 flex gap-1">
            {SCENES.map((_, i) => (
              <div
                key={i}
                className={`h-[2px] flex-1 transition-colors ${
                  i < totalDecided
                    ? "bg-[var(--color-ember)]"
                    : "bg-[var(--color-line)]"
                }`}
              />
            ))}
          </div>

          <div className="mb-8 flex items-center gap-6 font-mono text-[11px] tracking-[0.14em] uppercase">
            <span className="text-[var(--color-ember)]">
              ♥ {liked.length} liked
            </span>
            <span className="text-[var(--color-ink-3)]">
              ✕ {skipped.length} skipped
            </span>
          </div>

          {empty ? (
            <div>
              <p className="mb-6 max-w-md font-serif text-xl font-light leading-snug text-[var(--color-ink-2)]">
                {liked.length > 0
                  ? `You picked ${liked.length} look${liked.length === 1 ? "" : "s"}. Sign up to use them on your products.`
                  : "You skipped everything. Try again — pick at least one look."}
              </p>
              <div className="flex items-center gap-6">
                {liked.length > 0 ? (
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center gap-2 bg-[var(--color-ember)] px-6 py-3 font-mono text-xs tracking-[0.18em] text-white uppercase transition-opacity hover:opacity-90"
                  >
                    Continue &rarr;
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={reset}
                  className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase underline-offset-4 hover:text-[var(--color-ink)] hover:underline"
                >
                  ↺ Start over
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-6 max-w-md font-serif text-xl font-light leading-snug text-[var(--color-ink-2)]">
                Drag the top card. Or use{" "}
                <kbd className="rounded border border-[var(--color-line)] bg-[var(--color-paper-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-ink)]">
                  ←
                </kbd>{" "}
                /{" "}
                <kbd className="rounded border border-[var(--color-line)] bg-[var(--color-paper-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-ink)]">
                  →
                </kbd>{" "}
                to skip / save.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => decide("left")}
                  disabled={!topSlug || !!exiting}
                  className="inline-flex h-12 w-12 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-paper)] font-mono text-base text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-[var(--color-cream)] disabled:opacity-40 disabled:hover:bg-[var(--color-paper)] disabled:hover:text-[var(--color-ink)]"
                  aria-label="Skip"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={undo}
                  disabled={history.length === 0}
                  className="inline-flex h-12 w-12 items-center justify-center border border-[var(--color-line)] bg-[var(--color-paper)] font-mono text-xs text-[var(--color-ink-3)] transition-colors hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-30 disabled:hover:border-[var(--color-line)] disabled:hover:text-[var(--color-ink-3)]"
                  aria-label="Undo"
                >
                  ↺
                </button>
                <button
                  type="button"
                  onClick={() => decide("right")}
                  disabled={!topSlug || !!exiting}
                  className="inline-flex h-12 w-12 items-center justify-center border border-[var(--color-ember)] bg-[var(--color-ember)] font-mono text-base text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  aria-label="Save"
                >
                  ♥
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="order-1 mx-auto w-full max-w-[420px] md:order-2">
          <div className="relative aspect-[4/5] touch-none select-none">
            {[next2Slug, next1Slug, topSlug]
              .filter(Boolean)
              .map((slug, idx, arr) => {
                const card = SCENE_BY_SLUG[slug];
                if (!card) return null;
                const isTop = idx === arr.length - 1;
                const offset = arr.length - 1 - idx;
                const ty = offset * 14;
                const scale = 1 - offset * 0.04;

                let transform: string;
                let transition: string;
                if (isTop && exiting && exiting.slug === slug) {
                  const dx = exiting.dir === "right" ? 800 : -800;
                  const dr = exiting.dir === "right" ? 28 : -28;
                  transform = `translate(${dx}px, -40px) rotate(${dr}deg)`;
                  transition = `transform ${EXIT_MS}ms cubic-bezier(0.4,0,0.6,1), opacity ${EXIT_MS}ms`;
                } else if (isTop) {
                  const dragRot = drag.x * 0.06;
                  transform = `translate(${drag.x}px, ${drag.y * 0.4}px) rotate(${dragRot}deg)`;
                  transition = drag.active
                    ? "none"
                    : "transform 0.18s cubic-bezier(0.2,0.8,0.2,1)";
                } else {
                  transform = `translateY(${ty}px) scale(${scale})`;
                  transition = "transform 0.28s cubic-bezier(0.2,0.8,0.2,1)";
                }

                const opacity =
                  isTop && exiting && exiting.slug === slug ? 0 : 1;

                return (
                  <div
                    key={slug}
                    onPointerDown={isTop ? onPointerDown : undefined}
                    onPointerMove={isTop ? onPointerMove : undefined}
                    onPointerUp={isTop ? onPointerUp : undefined}
                    onPointerCancel={isTop ? onPointerUp : undefined}
                    className={`absolute inset-0 overflow-hidden border border-[var(--color-line)] bg-[var(--color-cream)] ${
                      isTop
                        ? "shadow-[0_18px_50px_rgba(27,25,21,0.22)]"
                        : "shadow-[0_8px_22px_rgba(27,25,21,0.10)]"
                    } ${isTop ? (drag.active ? "cursor-grabbing" : "cursor-grab") : "pointer-events-none"}`}
                    style={{ transform, transition, opacity }}
                  >
                    <img
                      src={`/marketing/styles/${card.slug}.jpg`}
                      alt={card.name}
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/75" />

                    <div className="absolute top-4 left-4 bg-black/55 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--color-cream)] backdrop-blur-sm">
                      REF_
                      {String(SCENE_INDEX[card.slug] + 1).padStart(3, "0")}
                      {" · "}
                      {card.category}
                    </div>

                    {isTop && (
                      <>
                        <div
                          className="pointer-events-none absolute top-8 left-6 rotate-[-12deg] border-[3px] border-[var(--color-ember)] bg-[var(--color-cream)]/85 px-3.5 py-2 font-mono text-xl font-bold tracking-[0.18em] text-[var(--color-ember)]"
                          style={{
                            opacity:
                              drag.x > 30
                                ? Math.min(1, drag.x / SWIPE_THRESHOLD)
                                : 0,
                            transition: drag.active
                              ? "none"
                              : "opacity 0.15s",
                          }}
                        >
                          SAVE
                        </div>
                        <div
                          className="pointer-events-none absolute top-8 right-6 rotate-[12deg] border-[3px] border-[var(--color-ink)] bg-[var(--color-cream)]/85 px-3.5 py-2 font-mono text-xl font-bold tracking-[0.18em] text-[var(--color-ink)]"
                          style={{
                            opacity:
                              drag.x < -30
                                ? Math.min(1, -drag.x / SWIPE_THRESHOLD)
                                : 0,
                            transition: drag.active
                              ? "none"
                              : "opacity 0.15s",
                          }}
                        >
                          NOPE
                        </div>
                      </>
                    )}

                    <div className="pointer-events-none absolute right-0 bottom-0 left-0 px-5 pt-12 pb-5 text-[var(--color-cream)]">
                      <h3 className="font-serif text-3xl font-light italic">
                        {card.name}
                      </h3>
                      <p className="mt-2 font-mono text-[10px] tracking-[0.14em] opacity-85">
                        {card.mood}
                      </p>
                      <div className="mt-3 flex h-1.5">
                        {card.palette.map((c, i) => (
                          <div
                            key={i}
                            className="flex-1"
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <p className="mt-6 text-center font-mono text-[10px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase">
            {empty
              ? "DECK COMPLETE"
              : `${String(totalDecided + 1).padStart(2, "0")} / ${String(SCENES.length).padStart(2, "0")} · SCENE DECK`}
          </p>
        </div>
      </div>
    </section>
  );
}
