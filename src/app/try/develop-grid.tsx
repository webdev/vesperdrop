/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";

const TILE_REVEAL_MS = 1100;
const STATUS_PHASES = ["EXPOSING", "DEVELOPING", "FIXING", "WASHING"] as const;
type Phase = (typeof STATUS_PHASES)[number];
const PHASE_DURATIONS_MS: Record<Phase, number> = {
  EXPOSING: 4500,
  DEVELOPING: 9000,
  FIXING: 6500,
  WASHING: 5000,
};
const ESTIMATED_TOTAL_MS =
  PHASE_DURATIONS_MS.EXPOSING +
  PHASE_DURATIONS_MS.DEVELOPING +
  PHASE_DURATIONS_MS.FIXING +
  PHASE_DURATIONS_MS.WASHING;

const DARKROOM_NOTES =
  "f/2.8 · ISO 400 · 1/125 · D-76 1:1 · 21°C · 9m30s · STOP 30s · FIX 5m · WASH 12m · DRY · ";
const GRAIN_HUD = [
  "SAMPLE 03",
  "CHANNEL R 47%",
  "CHANNEL G 52%",
  "CHANNEL B 51%",
  "GAMMA 2.20",
  "Δ 0.014",
  "ENTROPY 7.812",
  "PHASE LOCK",
];

export type TileResult = {
  sceneSlug: string;
  sceneName: string;
  status: "pending" | "succeeded" | "failed";
  outputUrl?: string;
  error?: string;
};

export type DevelopGridVariant = "darkroom" | "grain";

export function DevelopGrid({
  results,
  variant = "darkroom",
  sourceUrl,
}: {
  results: TileResult[];
  variant?: DevelopGridVariant;
  sourceUrl?: string;
}) {
  if (results.length === 0) {
    return (
      <div className="border border-dashed border-[var(--color-line)] bg-[var(--color-paper-2)] px-6 py-12 text-center font-mono text-[11px] tracking-[0.16em] text-[var(--color-ink-3)] uppercase">
        Pick at least one scene to develop
      </div>
    );
  }

  return (
    <>
      <style>{GLOBAL_KEYFRAMES}</style>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {results.map((r, i) => (
          <Tile
            key={r.sceneSlug}
            tile={r}
            index={i}
            total={results.length}
            variant={variant}
            sourceUrl={sourceUrl}
          />
        ))}
      </div>
    </>
  );
}

function Tile({
  tile,
  index,
  total,
  variant,
  sourceUrl,
}: {
  tile: TileResult;
  index: number;
  total: number;
  variant: DevelopGridVariant;
  sourceUrl?: string;
}) {
  const isDone = tile.status === "succeeded";
  const isFailed = tile.status === "failed";

  const seed = useMemo(() => hashSeed(tile.sceneSlug + ":" + index), [tile.sceneSlug, index]);
  const [startedAt] = useState(() => performance.now() - (seed % 800));
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (isDone || isFailed) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isDone, isFailed]);

  const elapsed = Math.max(0, now - startedAt);
  const phase: Phase = computePhase(elapsed);
  const progress = Math.min(0.99, elapsed / ESTIMATED_TOTAL_MS);
  const overrun = elapsed > ESTIMATED_TOTAL_MS;

  const filter = isDone ? "blur(0px) grayscale(0)" : "blur(20px) grayscale(1)";
  const staggerMs = (seed % 7) * 140;
  const cornerSeed = seed % 4;

  return (
    <div className="relative aspect-[4/5] overflow-hidden border border-[var(--color-line)] bg-[var(--color-ink)]">
      {tile.outputUrl ? (
        <img
          src={tile.outputUrl}
          alt={tile.sceneName}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: isDone ? 1 : 0,
            filter,
            transition: `filter ${TILE_REVEAL_MS}ms cubic-bezier(0.2,0.8,0.2,1), opacity 280ms ease-out`,
            zIndex: 30,
          }}
        />
      ) : null}

      {!isDone && !isFailed ? (
        variant === "grain" ? (
          <GrainTile
            sourceUrl={sourceUrl}
            phase={phase}
            progress={progress}
            overrun={overrun}
            staggerMs={staggerMs}
            seed={seed}
            cornerSeed={cornerSeed}
          />
        ) : (
          <DarkroomTile
            sourceUrl={sourceUrl}
            phase={phase}
            progress={progress}
            overrun={overrun}
            staggerMs={staggerMs}
            seed={seed}
            cornerSeed={cornerSeed}
          />
        )
      ) : null}

      {isFailed ? (
        <div className="pointer-events-none absolute inset-0 bg-[var(--color-ink)]" style={{ zIndex: 20 }} />
      ) : null}

      <div
        className="absolute top-2 left-2 bg-black/55 px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-[var(--color-cream)] uppercase backdrop-blur-sm"
        style={{ zIndex: 40 }}
      >
        {tile.sceneName} · {String(index + 1).padStart(2, "0")} /{" "}
        {String(total).padStart(2, "0")}
      </div>

      {!isDone ? (
        <div
          className="pointer-events-none absolute right-2 bottom-2 max-w-[80%] text-right font-mono text-[9px] uppercase"
          style={{ zIndex: 40 }}
        >
          {isFailed ? (
            <span className="bg-[var(--color-ember)]/85 px-1.5 py-0.5 tracking-[0.16em] text-[var(--color-cream)]">
              RESHOOT NEEDED
            </span>
          ) : (
            <span className="tracking-[0.18em] text-[var(--color-cream)]">
              {phase}
              <span className="ml-1 opacity-70">
                {Math.min(99, Math.round(progress * 100))
                  .toString()
                  .padStart(2, "0")}
                %
              </span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DarkroomTile({
  sourceUrl,
  phase,
  progress,
  overrun,
  staggerMs,
  seed,
  cornerSeed,
}: {
  sourceUrl?: string;
  phase: Phase;
  progress: number;
  overrun: boolean;
  staggerMs: number;
  seed: number;
  cornerSeed: number;
}) {
  const ghostStyle = ghostFilterFor(phase, "darkroom");
  const cornerOrigin = CORNERS[cornerSeed];
  const frameNum = 42 + Math.floor((progress * 78) | 0);

  return (
    <>
      {sourceUrl ? (
        <img
          src={sourceUrl}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            ...ghostStyle,
            zIndex: 5,
            transition: "filter 1400ms ease-out, opacity 1400ms ease-out, transform 1400ms ease-out",
          }}
        />
      ) : null}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 50%, transparent 30%, rgba(27,25,21,0.55) 90%)",
          mixBlendMode: "multiply",
          zIndex: 6,
        }}
      />

      <div
        className="pointer-events-none absolute -inset-1/3"
        style={{
          background:
            "linear-gradient(115deg, transparent 38%, rgba(250,247,240,0.10) 50%, transparent 62%)",
          animation: "vd-safelight-sweep 3.6s ease-in-out infinite alternate",
          animationDelay: `${staggerMs}ms`,
          mixBlendMode: "screen",
          zIndex: 8,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60% 50% at ${cornerOrigin.x} ${cornerOrigin.y}, rgba(232,165,139,0.55), rgba(194,69,28,0.18) 35%, transparent 65%)`,
          mixBlendMode: "screen",
          animation: `vd-light-leak ${4 + (seed % 3)}s ease-in-out infinite`,
          animationDelay: `${(seed % 5) * 600}ms`,
          zIndex: 9,
        }}
      />

      <ScrollingNotes text={DARKROOM_NOTES} edge="left" tone="cream" />

      <CornerBrackets tone="cream" />

      <FrameCounter
        label="EXP"
        current={frameNum}
        total={120}
        position="bottom-left"
        tone="cream"
      />

      <TravelingBorder />

      <ProgressBar progress={progress} overrun={overrun} orientation="horizontal" />
    </>
  );
}

function GrainTile({
  sourceUrl,
  phase,
  progress,
  overrun,
  staggerMs,
  seed,
  cornerSeed,
}: {
  sourceUrl?: string;
  phase: Phase;
  progress: number;
  overrun: boolean;
  staggerMs: number;
  seed: number;
  cornerSeed: number;
}) {
  const ghostStyle = ghostFilterFor(phase, "grain");
  const reticleX = 35 + ((seed * 7) % 30);
  const reticleY = 40 + ((seed * 11) % 25);
  const hudText = GRAIN_HUD.join("  ·  ") + "  ·  ";

  return (
    <>
      {sourceUrl ? (
        <img
          src={sourceUrl}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            ...ghostStyle,
            zIndex: 5,
            transition: "filter 1400ms ease-out, opacity 1400ms ease-out",
          }}
        />
      ) : null}

      <div
        className="pointer-events-none absolute -inset-4"
        style={{
          backgroundImage: GRAIN_SVG,
          backgroundSize: "220px 220px",
          opacity: 0.55,
          mixBlendMode: "overlay",
          animation: "vd-grain-shift 0.45s steps(2) infinite",
          zIndex: 7,
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 h-[18%]"
        style={{
          top: 0,
          background:
            "linear-gradient(180deg, rgba(180,210,235,0.55) 0%, rgba(180,210,235,0.05) 60%, transparent 100%)",
          mixBlendMode: "screen",
          animation: "vd-scanline-sweep 4.2s linear infinite",
          animationDelay: `${staggerMs}ms`,
          zIndex: 8,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(11,16,22,0.18) 3px, rgba(11,16,22,0.18) 4px)",
          mixBlendMode: "multiply",
          opacity: 0.45,
          zIndex: 8,
        }}
      />

      <Reticle x={reticleX} y={reticleY} cornerSeed={cornerSeed} />

      <ScrollingNotes text={hudText} edge="bottom" tone="cyan" />

      <CornerBrackets tone="cyan" />

      <FrameCounter
        label="SCAN"
        current={Math.floor(progress * 256)}
        total={256}
        position="top-right-below"
        tone="cyan"
      />

      <ProgressBar progress={progress} overrun={overrun} orientation="vertical" />
    </>
  );
}

function ghostFilterFor(phase: Phase, mode: "darkroom" | "grain") {
  if (mode === "darkroom") {
    switch (phase) {
      case "EXPOSING":
        return {
          opacity: 0.18,
          filter: "blur(48px) saturate(0.05) brightness(0.55) contrast(0.85)",
          transform: "scale(1.05)",
        };
      case "DEVELOPING":
        return {
          opacity: 0.42,
          filter:
            "blur(34px) saturate(0.35) brightness(0.7) sepia(0.45) hue-rotate(-12deg) contrast(0.95)",
          transform: "scale(1.03)",
        };
      case "FIXING":
        return {
          opacity: 0.55,
          filter:
            "blur(22px) saturate(0.7) brightness(0.78) sepia(0.25) contrast(1.1)",
          transform: "scale(1.01)",
        };
      case "WASHING":
        return {
          opacity: 0.7,
          filter: "blur(14px) saturate(0.85) brightness(0.85) contrast(1.05)",
          transform: "scale(1)",
        };
    }
  }
  switch (phase) {
    case "EXPOSING":
      return {
        opacity: 0.22,
        filter:
          "blur(44px) saturate(0) brightness(0.6) contrast(1.4) hue-rotate(180deg)",
        transform: "scale(1.05)",
      };
    case "DEVELOPING":
      return {
        opacity: 0.4,
        filter:
          "blur(30px) saturate(0.15) brightness(0.7) contrast(1.5) hue-rotate(190deg)",
        transform: "scale(1.03)",
      };
    case "FIXING":
      return {
        opacity: 0.55,
        filter:
          "blur(20px) saturate(0.4) brightness(0.78) contrast(1.3) hue-rotate(195deg)",
        transform: "scale(1.01)",
      };
    case "WASHING":
      return {
        opacity: 0.7,
        filter:
          "blur(12px) saturate(0.6) brightness(0.85) contrast(1.15) hue-rotate(200deg)",
        transform: "scale(1)",
      };
  }
}

function ScrollingNotes({
  text,
  edge,
  tone,
}: {
  text: string;
  edge: "left" | "bottom";
  tone: "cream" | "cyan";
}) {
  const color = tone === "cream" ? "rgba(250,247,240,0.55)" : "rgba(180,210,235,0.6)";
  const repeated = text.repeat(4);
  if (edge === "left") {
    return (
      <div
        className="pointer-events-none absolute top-0 bottom-0 left-0 w-4 overflow-hidden border-r border-[rgba(250,247,240,0.06)] bg-[rgba(27,25,21,0.4)]"
        style={{ zIndex: 12 }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 font-mono text-[8px] tracking-[0.2em] whitespace-nowrap uppercase"
          style={{
            color,
            writingMode: "vertical-rl",
            animation: "vd-notes-scroll-v 22s linear infinite",
          }}
        >
          {repeated}
        </div>
      </div>
    );
  }
  return (
    <div
      className="pointer-events-none absolute right-0 bottom-0 left-0 h-4 overflow-hidden border-t border-[rgba(180,210,235,0.18)] bg-[rgba(11,16,22,0.55)]"
      style={{ zIndex: 12 }}
    >
      <div
        className="absolute top-1/2 left-0 -translate-y-1/2 font-mono text-[8px] tracking-[0.18em] whitespace-nowrap uppercase"
        style={{
          color,
          animation: "vd-notes-scroll-h 18s linear infinite",
        }}
      >
        {repeated}
      </div>
    </div>
  );
}

function CornerBrackets({ tone }: { tone: "cream" | "cyan" }) {
  const color = tone === "cream" ? "rgba(250,247,240,0.7)" : "rgba(180,210,235,0.75)";
  const size = 10;
  const inset = 6;
  const thickness = 1;
  const corners: Array<{
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    borders: React.CSSProperties;
  }> = [
    {
      top: inset,
      left: inset,
      borders: { borderTop: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}` },
    },
    {
      top: inset,
      right: inset,
      borders: { borderTop: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` },
    },
    {
      bottom: inset,
      left: inset,
      borders: { borderBottom: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}` },
    },
    {
      bottom: inset,
      right: inset,
      borders: { borderBottom: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` },
    },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <div
          key={i}
          className="pointer-events-none absolute"
          style={{
            width: size,
            height: size,
            top: c.top,
            right: c.right,
            bottom: c.bottom,
            left: c.left,
            ...c.borders,
            zIndex: 13,
          }}
        />
      ))}
    </>
  );
}

function FrameCounter({
  label,
  current,
  total,
  position,
  tone,
}: {
  label: string;
  current: number;
  total: number;
  position: "bottom-left" | "top-right-below";
  tone: "cream" | "cyan";
}) {
  const color = tone === "cream" ? "rgba(250,247,240,0.85)" : "rgba(180,210,235,0.9)";
  const positionStyle: React.CSSProperties =
    position === "bottom-left"
      ? { left: 8, bottom: 8 }
      : { right: 8, top: 26 };
  return (
    <div
      className="pointer-events-none absolute font-mono text-[8px] tracking-[0.18em] uppercase"
      style={{
        color,
        ...positionStyle,
        zIndex: 14,
        textShadow: "0 0 6px rgba(0,0,0,0.6)",
      }}
    >
      {label} {String(current).padStart(4, "0")} / {String(total).padStart(4, "0")}
    </div>
  );
}

function Reticle({
  x,
  y,
  cornerSeed,
}: {
  x: number;
  y: number;
  cornerSeed: number;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 11, animation: `vd-reticle-drift-${cornerSeed % 2} 7s ease-in-out infinite alternate` }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <g stroke="rgba(180,210,235,0.85)" strokeWidth="0.25" fill="none">
        <circle cx={x} cy={y} r="6" />
        <circle cx={x} cy={y} r="2" />
        <line x1={x - 10} y1={y} x2={x - 7} y2={y} />
        <line x1={x + 7} y1={y} x2={x + 10} y2={y} />
        <line x1={x} y1={y - 10} x2={x} y2={y - 7} />
        <line x1={x} y1={y + 7} x2={x} y2={y + 10} />
      </g>
    </svg>
  );
}

function TravelingBorder() {
  const color = "var(--color-ember)";
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 13 }}
      preserveAspectRatio="none"
    >
      <rect
        x="0.5"
        y="0.5"
        width="calc(100% - 1px)"
        height="calc(100% - 1px)"
        fill="none"
        stroke={color}
        strokeOpacity="0.55"
        strokeWidth="1"
        strokeDasharray="6 8"
        style={{ animation: "vd-border-travel 6s linear infinite" }}
      />
    </svg>
  );
}

function ProgressBar({
  progress,
  overrun,
  orientation,
}: {
  progress: number;
  overrun: boolean;
  orientation: "horizontal" | "vertical";
}) {
  if (orientation === "horizontal") {
    return (
      <div
        className="pointer-events-none absolute right-0 bottom-0 left-0 h-[2px] overflow-hidden bg-[rgba(250,247,240,0.08)]"
        style={{ zIndex: 15 }}
      >
        <div
          className="h-full bg-[var(--color-ember)]"
          style={{
            width: `${progress * 100}%`,
            transition: "width 240ms ease-out",
            animation: overrun ? "vd-overrun-pulse 1.4s ease-in-out infinite" : undefined,
          }}
        />
      </div>
    );
  }
  return (
    <div
      className="pointer-events-none absolute top-0 right-0 bottom-0 w-[2px] overflow-hidden bg-[rgba(180,210,235,0.1)]"
      style={{ zIndex: 15 }}
    >
      <div
        className="absolute right-0 bottom-0 left-0 bg-[var(--color-ember)]"
        style={{
          height: `${progress * 100}%`,
          transition: "height 240ms ease-out",
          animation: overrun ? "vd-overrun-pulse 1.4s ease-in-out infinite" : undefined,
        }}
      />
    </div>
  );
}

function computePhase(elapsed: number): Phase {
  let acc = 0;
  for (const p of STATUS_PHASES) {
    acc += PHASE_DURATIONS_MS[p];
    if (elapsed < acc) return p;
  }
  return "WASHING";
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const CORNERS: Array<{ x: string; y: string }> = [
  { x: "12%", y: "18%" },
  { x: "82%", y: "22%" },
  { x: "20%", y: "78%" },
  { x: "78%", y: "82%" },
];

const GRAIN_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.98  0 0 0 0 0.97  0 0 0 0 0.94  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const GLOBAL_KEYFRAMES = `
  @keyframes vd-safelight-sweep {
    0% { transform: translateX(-60%) translateY(-20%) rotate(8deg); }
    100% { transform: translateX(60%) translateY(20%) rotate(8deg); }
  }
  @keyframes vd-grain-shift {
    0% { transform: translate3d(0, 0, 0); }
    25% { transform: translate3d(-2px, 1px, 0); }
    50% { transform: translate3d(1px, -2px, 0); }
    75% { transform: translate3d(-1px, 2px, 0); }
    100% { transform: translate3d(0, 0, 0); }
  }
  @keyframes vd-light-leak {
    0%, 100% { opacity: 0; }
    20% { opacity: 0.6; }
    35% { opacity: 0.15; }
    55% { opacity: 0.85; }
    75% { opacity: 0.2; }
  }
  @keyframes vd-scanline-sweep {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(560%); }
  }
  @keyframes vd-notes-scroll-h {
    0% { transform: translate(0, -50%); }
    100% { transform: translate(-50%, -50%); }
  }
  @keyframes vd-notes-scroll-v {
    0% { transform: translateX(-50%) translateY(0); }
    100% { transform: translateX(-50%) translateY(-50%); }
  }
  @keyframes vd-border-travel {
    0% { stroke-dashoffset: 0; }
    100% { stroke-dashoffset: -56; }
  }
  @keyframes vd-overrun-pulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }
  @keyframes vd-reticle-drift-0 {
    0% { transform: translate(0, 0); }
    100% { transform: translate(3%, -2%); }
  }
  @keyframes vd-reticle-drift-1 {
    0% { transform: translate(0, 0); }
    100% { transform: translate(-2%, 3%); }
  }
`;
