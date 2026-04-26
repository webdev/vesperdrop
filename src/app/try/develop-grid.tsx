/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";

const AFTERS = [
  "/marketing/before-after/jacket_after.png",
  "/marketing/before-after/skirt_after.png",
  "/marketing/before-after/cami_after.png",
  "/marketing/before-after/lace_after.png",
  "/marketing/before-after/jacket_after.png",
  "/marketing/before-after/skirt_after.png",
];

const STAGGER_MS = 800;
const TILE_REVEAL_MS = 1100;

type TileState = "idle" | "developing" | "done";

export function DevelopGrid({
  skip,
  onComplete,
}: {
  skip: boolean;
  onComplete: () => void;
}) {
  const [states, setStates] = useState<TileState[]>(() =>
    AFTERS.map(() => "idle"),
  );

  useEffect(() => {
    if (skip) {
      const t = window.setTimeout(onComplete, 0);
      return () => window.clearTimeout(t);
    }
    const timers: number[] = [];
    AFTERS.forEach((_, i) => {
      const startAt = i * STAGGER_MS;
      timers.push(
        window.setTimeout(() => {
          setStates((prev) => {
            const next = prev.slice();
            next[i] = "developing";
            return next;
          });
        }, startAt),
      );
      timers.push(
        window.setTimeout(() => {
          setStates((prev) => {
            const next = prev.slice();
            next[i] = "done";
            return next;
          });
        }, startAt + TILE_REVEAL_MS),
      );
    });
    const finalAt =
      (AFTERS.length - 1) * STAGGER_MS + TILE_REVEAL_MS + 200;
    timers.push(window.setTimeout(onComplete, finalAt));
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [skip, onComplete]);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
      {AFTERS.map((src, i) => {
        const state = skip ? "done" : states[i];
        const isIdle = state === "idle";
        const isDeveloping = state === "developing";
        const isDone = state === "done";
        const filter = isDone
          ? "blur(0px) grayscale(0)"
          : "blur(20px) grayscale(1)";
        const imgOpacity = isIdle ? 0 : 1;
        return (
          <div
            key={i}
            className="relative aspect-[4/5] overflow-hidden border border-[var(--color-line)] bg-[var(--color-ink)]"
          >
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                opacity: imgOpacity,
                filter,
                transition: `filter ${TILE_REVEAL_MS}ms cubic-bezier(0.2,0.8,0.2,1), opacity 280ms ease-out`,
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[var(--color-ink)]"
              style={{
                opacity: isIdle ? 1 : 0,
                transition: "opacity 320ms ease-out",
              }}
            />
            <div className="absolute top-2 left-2 bg-black/55 px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-[var(--color-cream)] uppercase backdrop-blur-sm">
              FRAME {String(i + 1).padStart(2, "0")} / 06
            </div>
            {!isDone ? (
              <div className="absolute right-2 bottom-2 font-mono text-[9px] tracking-[0.16em] text-[var(--color-cream)]/85 uppercase">
                {isDeveloping ? "DEVELOPING…" : "QUEUED"}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
