"use client";

import { useEffect, useMemo, useState } from "react";
import type { Generation, SceneInfo } from "@/app/(app)/app/runs/[id]/run-grid";
import { FaceSafeImage } from "@/components/ui/face-safe-image";

// REAL DATA NOTES
//
// Sceneify gives us 4 row states (pending | running | succeeded | failed) plus
// createdAt/completedAt timestamps — that's it. There is no streaming progress,
// no preview URL, no preparing/enhancing emitted by Sceneify itself.
//
// The 5-step timeline (queued → preparing → generating → enhancing → completed)
// is DERIVED from real elapsed time bucketed against the average completion
// duration in this run. We never claim to be past a row's true status — a
// running row showing "enhancing" is genuinely running with elapsed time past
// the estimated midpoint; the ring asymptotes toward 95% and only hits 100%
// when the row actually succeeds.
//
// Microcopy under each phase rotates every ~2s for liveness; rotation is
// purely decorative copy variation, gated by real status.

interface Props {
  generations: Generation[];
  scenes: SceneInfo[];
}

type Phase =
  | "queued"
  | "preparing"
  | "generating"
  | "enhancing"
  | "completed"
  | "failed";

const PHASES: ReadonlyArray<Exclude<Phase, "failed">> = [
  "queued",
  "preparing",
  "generating",
  "enhancing",
  "completed",
];

const PHASE_LABELS: Record<Phase, string> = {
  queued: "In line",
  preparing: "Setting up",
  generating: "Composing",
  enhancing: "Polishing",
  completed: "Completed",
  failed: "Failed",
};

// Editorial-voice rotating microcopy. Cosmetic — fires only while the row's
// real status is running/pending. The phrases imply "alive, working" more
// than they describe what fal is literally doing this exact second.
const PHASE_MICROCOPY: Record<Phase, string[]> = {
  queued: [
    "Waiting in the wings",
    "Queued for studio time",
    "On deck",
    "Holding for the call sheet",
    "Awaiting the green light",
    "Up next on the dock",
  ],
  preparing: [
    "Reading the source",
    "Studying the garment",
    "Pulling the palette",
    "Briefing the scene",
    "Pre-lighting the set",
    "Scouting the location",
    "Loading the deck",
    "Setting the dressing",
    "Pinning the moodboard",
  ],
  generating: [
    "Composing the frame",
    "Drawing the silhouette",
    "Painting in the light",
    "Sculpting the look",
    "Layering textures",
    "Finding the angle",
    "Posing the model",
    "Working the moodboard",
    "Translating the brief",
    "Rendering the moment",
    "Building the world",
    "Casting the shadow",
    "Tuning the depth",
    "Letting it breathe",
    "Catching the light",
    "Moving the eye",
    "Holding the gaze",
    "Chasing the look",
    "Reading the room",
  ],
  enhancing: [
    "Polishing the edges",
    "Toning the highlights",
    "Cleaning the shadows",
    "Refining the grain",
    "Balancing the palette",
    "Quieting the noise",
    "Sharpening the detail",
    "Final color pass",
    "Last look from the editor",
    "Setting the contrast",
    "Lifting the midtones",
    "Settling the frame",
    "Letting the print dry",
  ],
  completed: ["Ready"],
  failed: ["Something went wrong"],
};

const MICROCOPY_INTERVAL_MS = 1800;
const ANTICIPATION_THRESHOLD = 80;

// Picks the next index in a phrase bank that is NOT the previous one, using a
// uniform-random pick from the remaining N−1 slots. Cheap, no full shuffle,
// and guarantees no immediate repeats.
function nextIndex(prev: number, len: number): number {
  if (len <= 1) return 0;
  const r = Math.floor(Math.random() * (len - 1));
  return r >= prev ? r + 1 : r;
}

const DEFAULT_AVG_SEC = 45;

export function HeroGenerationCard({ generations, scenes }: Props) {
  const sceneNameBySlug = useMemo(
    () => new Map(scenes.map((s) => [s.slug, s.name])),
    [scenes],
  );

  const items = useMemo(
    () => generations.filter((g) => !g.packId),
    [generations],
  );

  const total = items.length;
  const succeeded = items.filter((g) => g.status === "succeeded").length;
  const failed = items.filter((g) => g.status === "failed").length;
  const done = succeeded + failed;
  const inProgress = items.some(
    (g) => g.status === "pending" || g.status === "running",
  );

  // Average completed duration drives ETAs and per-image estimated %.
  const avgSec = useMemo(() => {
    const ds = items
      .filter((g) => g.status === "succeeded" && g.createdAt && g.completedAt)
      .map(
        (g) =>
          (new Date(g.completedAt!).getTime() -
            new Date(g.createdAt!).getTime()) /
          1000,
      )
      .filter((s) => s > 0 && Number.isFinite(s));
    if (ds.length === 0) return DEFAULT_AVG_SEC;
    return ds.reduce((a, b) => a + b, 0) / ds.length;
  }, [items]);

  // Active gen = first running, else first pending. Always exists when inProgress.
  const active =
    items.find((g) => g.status === "running") ??
    items.find((g) => g.status === "pending") ??
    null;

  // Heartbeat: drive the asymptotic ring + rotating microcopy.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!inProgress) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [inProgress]);

  // Compute the active gen's elapsed + phase BEFORE the early return so that
  // the microcopy effect can depend on activePhase without breaking rules of
  // hooks. When inProgress/active are absent, the values are harmless defaults.
  const activeElapsedSec =
    active?.createdAt
      ? Math.max(0, (now - new Date(active.createdAt).getTime()) / 1000)
      : 0;
  const activePhase: Phase = active
    ? phaseFor(active, activeElapsedSec, avgSec)
    : "queued";

  const microBank = PHASE_MICROCOPY[activePhase];

  // Microcopy index, advanced via no-repeat picker every ~1.5s while running.
  // We let the index persist across phase changes — it gets modulo'd against
  // the new bank and lands on a valid phrase, no jarring jump.
  const [microIdx, setMicroIdx] = useState(0);
  useEffect(() => {
    if (!inProgress) return;
    const t = setInterval(() => {
      setMicroIdx((prev) => nextIndex(prev, microBank.length));
    }, MICROCOPY_INTERVAL_MS);
    return () => clearInterval(t);
  }, [inProgress, microBank.length]);

  if (!inProgress || !active) return null;

  // Asymptotic ring — approaches 95% as elapsed/avg grows; never claims 100%
  // until the row actually succeeds.
  const activePct =
    active.status === "succeeded"
      ? 100
      : active.status === "failed"
        ? 0
        : Math.round(95 * (1 - Math.exp(-(activeElapsedSec / avgSec) * 1.2)));

  const remainingItems = total - done;
  // Honest ETA: avg × items left, minus what we've already spent on the active.
  const overallEtaSec =
    remainingItems > 0
      ? Math.max(1, Math.round(avgSec * remainingItems - activeElapsedSec))
      : null;

  const subLabel = microBank[microIdx % microBank.length] ?? PHASE_LABELS[activePhase];

  const activeSceneName =
    sceneNameBySlug.get(active.presetId) ?? active.presetId;

  const completedSiblings = items
    .filter((g) => g.status === "succeeded" && g.outputUrl && g.id !== active.id)
    .slice(0, 3);

  const nearDone = activePct > ANTICIPATION_THRESHOLD;

  return (
    <section className="space-y-6">
      <div
        className="mx-auto w-full max-w-[940px] overflow-hidden rounded-[24px] border border-line-soft bg-surface"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.06)" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px]">
          <ImageArea
            sceneName={activeSceneName}
            pct={activePct}
            siblings={completedSiblings}
            microcopy={subLabel}
            nearDone={nearDone}
          />
          <Timeline currentPhase={activePhase} />
        </div>

        <div className="flex items-end justify-between gap-6 border-t border-line-soft bg-paper-soft px-6 py-3.5">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-terracotta">
              {nearDone ? "Almost ready" : PHASE_LABELS[activePhase]}
            </p>
            <p className="mt-1 truncate text-[12px] text-ink-3">
              {activeSceneName}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {overallEtaSec !== null ? (
              <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-3 tabular-nums">
                {formatSeconds(overallEtaSec)} remaining
              </p>
            ) : (
              <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-4">
                Estimating
              </p>
            )}
            {total > 1 ? (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-4 tabular-nums">
                {done} / {total}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <WhileYouWait />
    </section>
  );
}

function phaseFor(g: Generation, elapsedSec: number, avgSec: number): Phase {
  if (g.status === "pending") return "queued";
  if (g.status === "succeeded") return "completed";
  if (g.status === "failed") return "failed";
  // running — bucket elapsed/avg into preparing/generating/enhancing
  const ratio = avgSec > 0 ? elapsedSec / avgSec : 0;
  if (ratio < 0.2) return "preparing";
  if (ratio < 0.7) return "generating";
  return "enhancing";
}

function formatSeconds(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function ImageArea({
  sceneName,
  pct,
  siblings,
  microcopy,
  nearDone,
}: {
  sceneName: string;
  pct: number;
  siblings: Generation[];
  microcopy: string;
  nearDone: boolean;
}) {
  return (
    <div className="relative flex min-h-[460px] items-center justify-center overflow-hidden bg-gradient-to-br from-paper-2 via-paper-soft to-paper-2 p-10">
      {/* Background motion — soft drifting gradient; barely visible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] motion-safe:animate-[drift_18s_ease-in-out_infinite]"
        style={{
          background:
            "radial-gradient(circle at 30% 35%, rgba(255,255,255,0.6), transparent 45%), radial-gradient(circle at 70% 65%, rgba(0,0,0,0.06), transparent 50%)",
        }}
      />

      {/* Anticipation: when pct > 80 we add a soft veil + a single shimmer
          sweep across the card. Both are pure CSS, no JS animation. */}
      {nearDone ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 backdrop-blur-[1px] bg-cream/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 motion-safe:animate-[shimmer_1800ms_ease-out_forwards]"
            style={{
              background:
                "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%)",
              backgroundSize: "200% 100%",
            }}
          />
        </>
      ) : null}

      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="relative">
          <ProgressRing pct={pct} />
          {/* Floating accent spark — small terracotta dot drifting near the
              ring. Premium liveness without distracting motion. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-1 -top-2 h-1.5 w-1.5 rounded-full bg-terracotta motion-safe:animate-[spark_3200ms_ease-in-out_infinite]"
            style={{ boxShadow: "0 0 8px rgba(194,96,76,0.6)" }}
          />
        </div>
        {/* Editorial rotating phrase — keyed on text so each new phrase
            re-mounts and gets the fade animation. */}
        <p
          key={microcopy}
          className="min-h-[1.6em] max-w-[300px] text-center font-serif text-[18px] italic leading-[1.3] text-ink opacity-0 motion-safe:animate-[fadein_600ms_ease-out_forwards]"
        >
          {microcopy}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
          {sceneName}
        </p>
      </div>

      {siblings.length > 0 ? (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {siblings.map((g) => (
            <div
              key={g.id}
              className="relative h-12 w-12 overflow-hidden rounded-md border border-line-soft bg-paper-2 opacity-70 shadow-subtle"
            >
              <FaceSafeImage
                src={`/api/images/${g.id}`}
                alt=""
                fill
                sizes="48px"
                unoptimized
                className="object-cover"
                faceBox={g.faceBox}
                focalPoint={g.focalPoint}
              />
            </div>
          ))}
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes drift {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(-6px, 4px, 0);
          }
        }
        @keyframes fadein {
          from {
            opacity: 0;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shimmer {
          from {
            background-position: -100% 0;
            opacity: 0.8;
          }
          to {
            background-position: 200% 0;
            opacity: 0;
          }
        }
        @keyframes spark {
          0%,
          100% {
            transform: translateY(0) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-6px) scale(1.25);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const size = 100;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div className="relative h-[100px] w-[100px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.07)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-terracotta, #c2604c)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: "stroke-dashoffset 700ms ease-out",
            filter: "drop-shadow(0 0 4px rgba(194,96,76,0.45))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-[28px] leading-none text-ink tabular-nums">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

function Timeline({ currentPhase }: { currentPhase: Phase }) {
  const idx =
    currentPhase === "failed" ? -1 : PHASES.indexOf(currentPhase);
  return (
    <div className="border-t border-line-soft/60 bg-surface px-5 py-5 md:border-l md:border-t-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4">
        Steps
      </p>
      <ol className="mt-3 space-y-2.5">
        {PHASES.map((p, i) => {
          const state =
            i < idx ? "past" : i === idx ? "current" : "future";
          const ringClass =
            state === "past"
              ? "border-ink-3/70 bg-ink-3/70 text-cream"
              : state === "current"
                ? "border-terracotta bg-terracotta text-cream motion-safe:animate-pulse"
                : "border-line bg-surface text-transparent";
          // Reduced weight: past 60%, future 40%, current full.
          const rowOpacity =
            state === "current"
              ? "opacity-100"
              : state === "past"
                ? "opacity-60"
                : "opacity-40";
          const labelClass =
            state === "current" ? "font-medium text-ink" : "text-ink-2";
          return (
            <li key={p} className={`flex items-center gap-2.5 ${rowOpacity}`}>
              <span
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${ringClass}`}
              >
                {state === "past" ? (
                  <span className="text-[8px] leading-none">✓</span>
                ) : null}
              </span>
              <span className={`text-[12px] ${labelClass}`}>
                {PHASE_LABELS[p]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function WhileYouWait() {
  return (
    <div className="rounded-2xl border border-line-soft bg-paper-soft p-6 md:p-8">
      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            What&rsquo;s happening?
          </p>
          <p className="mt-3 font-serif text-[20px] leading-[1.3] tracking-[-0.01em] text-ink">
            Your image is being composed
          </p>
          <p className="mt-3 text-[13px] leading-[1.6] text-ink-3">
            Vesperdrop analyzes your source photo, plans lighting and
            styling, and renders a high-quality result in under a minute.
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            Tips
          </p>
          <ul className="mt-3 space-y-2 text-[13px] leading-[1.5] text-ink-2">
            <li className="flex items-start gap-2">
              <span className="mt-1 text-terracotta" aria-hidden>
                ✦
              </span>
              Download every result in HD from your library.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 text-terracotta" aria-hidden>
                ✦
              </span>
              Reuse this style on a new product anytime.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 text-terracotta" aria-hidden>
                ✦
              </span>
              Edit, rename, or delete batches from the Library page.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
