/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { pickLine, type PhaseId, type PresetMeta } from "@/lib/progress/strings";
import type { ExtractedAttributes } from "@/lib/ai/extract-attributes";
import type { TileResult } from "./develop-grid";
import { failureBody, failureHeadline } from "./credit-error-copy";

const MAX_VISIBLE_CARDS = 6;
const TOTAL_EST_MS = 70_000;

const PHASE_TITLE: Record<PhaseId, string> = {
  reading: "Mapping silhouette",
  choosing: "Building composition",
  composing: "Enhancing texture",
  matching: "Balancing tones",
  finishing: "Finalizing image",
};

const PHASE_SUBTITLE: Record<PhaseId, string> = {
  reading: "Analyzing shape and proportions",
  choosing: "Setting the scene and depth",
  composing: "Refining materials and details",
  matching: "Optimizing light and contrast",
  finishing: "Preparing your high-res preview",
};

const SYNTHETIC_TITLES = [
  "Building composition",
  "Mapping silhouette",
  "Enhancing texture",
  "Balancing tones",
  "Fine tuning color",
  "Polishing shadows",
];

const SYNTHETIC_SUBTITLES = [
  "Setting the scene and depth",
  "Refining materials and details",
  "Optimizing light and contrast",
  "Bringing out the natural hues",
  "Improving depth and realism",
];

type Props = {
  results: TileResult[];
  sourceUrl?: string;
  sourceName?: string;
  sceneNames: string[];
  /** True after all results have streamed in. */
  allDone: boolean;
  /**
   * Optional grid renderer. Defaults to the streaming `StudioGrid` (dark
   * editorial cards with status overlays) used by the /try developing
   * state. /try/b/[token] passes the resolved `DevelopGrid` instead so a
   * persisted batch reuses the same shell (left rail) around its
   * post-generation tiles — one design, count-adaptive layout.
   */
  renderGrid?: (args: { results: TileResult[]; count: number }) => React.ReactNode;
};

/**
 * Editorial "In the studio." frame.
 *
 * Used by both the live /try developing state and the persisted
 * /try/b/[token] view, so the layout stays consistent across the entire
 * post-upload lifecycle. Adapts to image count:
 *   - 1 image   → centered hero, horizontal offer strip below
 *   - 2 images  → hero + supporting composition
 *   - 3 images  → 3 cards in a balanced row, horizontal offer strip below
 *   - 4–6 images → 3-column grid + right rail offer card
 *
 * The middle grid is pluggable via `renderGrid` so the streaming and
 * persisted call sites can each render their own tile system inside the
 * shared shell.
 */
export function StudioDevelopFrame({
  results,
  sourceUrl,
  sourceName,
  sceneNames,
  allDone,
  renderGrid,
}: Props) {
  const visible = results.slice(0, MAX_VISIBLE_CARDS);
  const count = visible.length;

  // Whole-batch failure: no tile succeeded AND at least one tile has
  // explicitly failed. This is the all-failed case (most commonly an
  // anonymous visitor hitting the free-render cap → 402
  // `credit_limit_reached`). try-flow.tsx only calls onComplete() when a
  // tile succeeds, so an all-failed batch never leaves this frame — without
  // a dedicated error state the user just stares at a blurred/blank frame.
  // A partial failure (≥1 succeeded) keeps rendering the grid so the
  // succeeded result(s) stay visible; per-tile failures are handled by the
  // StudioCard overlay.
  const anySucceeded = visible.some((r) => r.status === "succeeded");
  const firstFailed = visible.find((r) => r.status === "failed");
  const batchFailed = count > 0 && !anySucceeded && firstFailed != null;
  const allDoneOrFailed = allDone || batchFailed;

  return (
    <section
      data-testid="studio-frame"
      data-count={count}
      data-batch-failed={batchFailed ? "true" : "false"}
      className="relative"
    >
      {/* Warm radial atmosphere behind the grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(56% 44% at 50% 30%, rgba(244, 226, 216, 0.55) 0%, transparent 70%), radial-gradient(120% 80% at 50% 100%, rgba(234, 208, 195, 0.32) 0%, transparent 70%)",
        }}
      />

      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[220px_1fr] md:gap-10 lg:grid-cols-[240px_1fr] lg:gap-12">
        <StudioLeftRail
          sourceUrl={sourceUrl}
          sourceName={sourceName}
          sceneNames={sceneNames}
          count={count}
          allDone={allDoneOrFailed}
          failed={batchFailed}
        />

        <div className="min-w-0">
          {batchFailed ? (
            <StudioErrorPanel
              errorCode={firstFailed?.errorCode}
              errorMessage={firstFailed?.error}
            />
          ) : renderGrid ? (
            renderGrid({ results: visible, count })
          ) : (
            <StudioGrid results={visible} sourceUrl={sourceUrl} />
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Error panel — shown when the whole batch failed (no tile succeeded).
 *
 * Replaces the blurred render frame so the visitor sees a clear, on-brand
 * message instead of an endless "developing" state. Keeps the cinematic
 * aesthetic (ivory surface, serif headline, mono labels, terracotta accent)
 * and renders identically across desktop and mobile — it lives in the same
 * responsive `min-w-0` slot the grid would occupy, so no separate mobile
 * tree is needed. No animation, so it is reduced-motion-safe by default.
 * ------------------------------------------------------------------------- */

function StudioErrorPanel({
  errorCode,
  errorMessage,
}: {
  errorCode?: string;
  errorMessage?: string;
}) {
  const headline = failureHeadline(errorCode);
  const body = failureBody(errorCode, errorMessage);
  // `credit_limit_reached` is the unauth out-of-free-renders case — drive to
  // plans (§15a-compliant: no "Try free"/"free trial"/time-bound copy). Other
  // failures are transient; offer a refresh-to-retry affordance.
  const isOutOfRenders = errorCode === "credit_limit_reached";
  const isQuotaExhausted = errorCode === "quota_exhausted";
  const showPlansCta = isOutOfRenders || isQuotaExhausted;

  return (
    <div
      data-testid="studio-error-panel"
      data-error-code={errorCode ?? ""}
      role="alert"
      className="flex min-h-[360px] flex-col items-center justify-center rounded-[20px] border border-line-soft bg-surface px-6 py-12 text-center shadow-card md:min-h-[440px]"
    >
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-terracotta-wash text-terracotta-dark"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </span>

      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta-dark">
        {showPlansCta ? "Out of renders" : "Generation failed"}
      </p>

      <h3 className="mt-2 font-serif text-[1.9rem] leading-[1.05] tracking-[-0.01em] text-ink">
        {headline}
      </h3>

      <p className="mt-3 max-w-[34ch] text-[13.5px] leading-[1.5] text-ink-3">
        {body}
      </p>

      <div className="mt-7">
        {showPlansCta ? (
          <a
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 font-mono text-[12px] uppercase tracking-[0.14em] text-cream transition-colors hover:bg-ink-2"
          >
            View plans →
          </a>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 font-mono text-[12px] uppercase tracking-[0.14em] text-cream transition-colors hover:bg-ink-2"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Left rail
 * ------------------------------------------------------------------------- */

function StudioLeftRail({
  sourceUrl,
  sourceName,
  sceneNames,
  count,
  allDone,
  failed = false,
}: {
  sourceUrl?: string;
  sourceName?: string;
  sceneNames: string[];
  count: number;
  allDone: boolean;
  failed?: boolean;
}) {
  return (
    <aside className="flex flex-col gap-7" data-testid="studio-left-rail">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
          Your product
        </p>
        <div className="mt-4 aspect-square w-full overflow-hidden rounded-md border border-line-soft bg-surface shadow-subtle">
          {sourceUrl ? (
            <img
              src={sourceUrl}
              alt={sourceName ?? "Your product"}
              draggable={false}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
              No product
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
          Selected scenes · {count}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sceneNames.slice(0, MAX_VISIBLE_CARDS).map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-full border border-terracotta/30 bg-terracotta-wash px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta-dark"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      <StatusCard count={count} allDone={allDone} failed={failed} />
    </aside>
  );
}

function StatusCard({
  count,
  allDone,
  failed = false,
}: {
  count: number;
  allDone: boolean;
  failed?: boolean;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (allDone) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);
    return () => window.clearInterval(id);
  }, [allDone]);

  const remainingMs = Math.max(0, TOTAL_EST_MS - elapsedMs);
  const mins = Math.floor(remainingMs / 60_000);
  const secs = Math.floor((remainingMs % 60_000) / 1000);
  const remainingLabel = allDone
    ? "00:00"
    : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="rounded-xl border border-line-soft bg-surface p-5 shadow-subtle md:p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta-wash text-terracotta-dark"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <p className="text-[13px] leading-[1.4] text-ink-2">
          {failed ? (
            <span className="font-medium">Generation paused</span>
          ) : (
            <>
              <span className="font-medium">
                {count} campaign image{count === 1 ? "" : "s"}
              </span>{" "}
              {allDone ? "ready" : "developing"}
            </>
          )}
        </p>
      </div>

      {failed ? (
        <p className="mt-5 text-[12px] leading-[1.5] text-ink-3">
          We hit a snag — see the details to keep going.
        </p>
      ) : (
        <>
          <div className="mt-5 border-t border-line-soft pt-4">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-4">
              Est. time remaining
            </p>
            <p className="mt-1.5 font-serif text-[1.65rem] leading-none tracking-[-0.01em] text-ink tabular-nums">
              {remainingLabel}
            </p>
          </div>

          <p className="mt-5 text-[12px] leading-[1.5] text-ink-3">
            You&apos;ll be notified when they&apos;re ready.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Main grid — switches layout by image count
 * ------------------------------------------------------------------------- */

function StudioGrid({
  results,
  sourceUrl,
}: {
  results: TileResult[];
  sourceUrl?: string;
}) {
  const count = results.length;

  if (count === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-paper-soft px-6 py-12 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Pick at least one scene to develop
      </div>
    );
  }

  if (count === 1) {
    return (
      <div className="grid grid-cols-1 gap-4">
        <StudioCard tile={results[0]} index={0} total={count} sourceUrl={sourceUrl} aspect="landscape" />
      </div>
    );
  }

  if (count === 2) {
    // Hero + supporting composition. Hero (index 0) takes ~60% width,
    // supporting card takes ~40%. On mobile they stack.
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.55fr_1fr] sm:gap-4">
        <StudioCard
          tile={results[0]}
          index={0}
          total={count}
          sourceUrl={sourceUrl}
          aspect="landscape"
        />
        <StudioCard
          tile={results[1]}
          index={1}
          total={count}
          sourceUrl={sourceUrl}
          aspect="portrait"
        />
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {results.map((r, i) => (
          <StudioCard
            key={r.sceneSlug}
            tile={r}
            index={i}
            total={count}
            sourceUrl={sourceUrl}
            aspect="portrait"
          />
        ))}
      </div>
    );
  }

  // 4–6 images: 3-column grid. 4 renders as 3+1, 5 as 3+2, 6 as 3x2.
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3">
      {results.map((r, i) => (
        <StudioCard
          key={r.sceneSlug}
          tile={r}
          index={i}
          total={count}
          sourceUrl={sourceUrl}
          aspect="portrait"
          compact
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * StudioCard — editorial generation card
 * ------------------------------------------------------------------------- */

type Aspect = "portrait" | "landscape";

function StudioCard({
  tile,
  index,
  total,
  sourceUrl,
  aspect = "portrait",
  compact = false,
}: {
  tile: TileResult;
  index: number;
  total: number;
  sourceUrl?: string;
  aspect?: Aspect;
  compact?: boolean;
}) {
  const isDone = tile.status === "succeeded";
  const isFailed = tile.status === "failed";

  const liveMode = tile.streamPhaseId != null && tile.presetMeta != null;

  // Rotating supporting line — uses real stream phase when available, falls
  // back to a synthetic rotation so the tile never sits silent.
  const [liveLine, setLiveLine] = useState<string>("");
  const [syntheticIdx, setSyntheticIdx] = useState(0);
  const lineHistoryRef = useRef<string[]>([]);
  const phaseRef = useRef<PhaseId | null>(null);
  const attrRef = useRef<ExtractedAttributes | null>(null);
  const presetRef = useRef<PresetMeta | null>(null);
  useEffect(() => {
    phaseRef.current = tile.streamPhaseId ?? null;
    attrRef.current = tile.streamAttributes ?? null;
    presetRef.current = tile.presetMeta ?? null;
  });

  useEffect(() => {
    if (isDone || isFailed) return;
    const stagger = (index % 5) * 380;
    const tick = () => {
      const phase = phaseRef.current;
      const preset = presetRef.current;
      if (phase && preset) {
        const next = pickLine(phase, attrRef.current, preset, lineHistoryRef.current);
        lineHistoryRef.current = [...lineHistoryRef.current.slice(-2), next];
        setLiveLine(next);
      } else {
        setSyntheticIdx((i) => (i + 1) % SYNTHETIC_SUBTITLES.length);
      }
    };
    const t = window.setTimeout(tick, stagger);
    const interval = window.setInterval(tick, 2800);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(interval);
    };
  }, [isDone, isFailed, index]);

  // Local time-based progress when no real stream phase has landed yet.
  // Once the tile completes we freeze; while pending we drive a 60fps tick.
  const [elapsed, setElapsed] = useState(() => index * 240);
  useEffect(() => {
    if (isDone || isFailed) return;
    const startedAt = performance.now() - index * 240;
    let raf = 0;
    const tick = () => {
      setElapsed(Math.max(0, performance.now() - startedAt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isDone, isFailed, index]);

  const baseProgress = Math.min(0.95, elapsed / TOTAL_EST_MS);
  const progress = isDone ? 1 : isFailed ? 0 : baseProgress;

  // Map server error codes from /api/try/generate to readable copy via the
  // shared `credit-error-copy` module so the streaming Studio card and the
  // post-stream DevelopGrid speak the same language (§9, no duplication).
  const failureTitle = failureHeadline(tile.errorCode);
  const failureSubtitle = failureBody(tile.errorCode, tile.error);

  const title = isDone
    ? "Ready"
    : isFailed
      ? failureTitle
      : tile.streamPhaseId
        ? PHASE_TITLE[tile.streamPhaseId]
        : SYNTHETIC_TITLES[(index + Math.floor(elapsed / 4000)) % SYNTHETIC_TITLES.length];

  const subtitle = isDone
    ? null
    : isFailed
      ? failureSubtitle
      : liveMode && liveLine
        ? liveLine
        : tile.streamPhaseId
          ? PHASE_SUBTITLE[tile.streamPhaseId]
          : SYNTHETIC_SUBTITLES[(index + syntheticIdx) % SYNTHETIC_SUBTITLES.length];

  const aspectClass = aspect === "landscape" ? "aspect-[16/11]" : "aspect-[4/5]";
  const minHeightClass = compact ? "" : aspect === "landscape" ? "min-h-[360px]" : "min-h-[440px]";

  return (
    <div
      className="group relative overflow-hidden rounded-[20px] border border-line-soft/70 bg-[#1f1c19] shadow-card"
      data-testid="studio-card"
      data-scene-slug={tile.sceneSlug}
      data-tile-status={tile.status}
    >
      <div className={`relative w-full ${aspectClass} ${minHeightClass}`}>
        {/* Blurred preview of the user's product as warm background */}
        {sourceUrl ? (
          <img
            src={sourceUrl}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              filter: isDone
                ? "blur(0px) saturate(1)"
                : "blur(28px) saturate(0.78) brightness(0.62)",
              transform: isDone ? "scale(1)" : "scale(1.12)",
              opacity: isDone ? 0 : 0.78,
              transition:
                "filter 900ms cubic-bezier(0.2,0.8,0.2,1), transform 900ms cubic-bezier(0.2,0.8,0.2,1), opacity 600ms ease-out",
            }}
          />
        ) : null}

        {/* Warm gradient overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15, 12, 10, 0.18) 0%, rgba(15, 12, 10, 0.30) 55%, rgba(15, 12, 10, 0.62) 100%), radial-gradient(80% 60% at 50% 35%, rgba(232, 165, 139, 0.12), transparent 70%)",
          }}
        />

        {/* Result image fades in when generation succeeds */}
        {tile.outputUrl && isDone ? (
          <img
            src={tile.outputUrl}
            alt={tile.sceneName}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: 1,
              transition: "opacity 700ms ease-out",
              objectPosition: tile.focalPoint
                ? `${Math.round(tile.focalPoint.x * 100)}% ${Math.round(tile.focalPoint.y * 100)}%`
                : "center",
            }}
          />
        ) : null}

        {/* Corner crop marks — top-left, top-right, bottom-left, bottom-right */}
        <CornerMarks />

        {/* Top-left label pill */}
        <div
          className="absolute left-3 top-3 inline-flex items-center rounded-md bg-black/70 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-cream backdrop-blur-sm"
          style={{ zIndex: 30 }}
        >
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} · {tile.sceneName}
        </div>

        {/* Bottom-left status block */}
        {!isDone ? (
          <div
            className={`absolute left-4 right-4 ${compact ? "bottom-3" : "bottom-4"} flex flex-col gap-1.5`}
            style={{ zIndex: 30 }}
          >
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-terracotta-soft">
                <SparkleIcon size={compact ? 12 : 14} />
              </span>
              <span
                className={`font-serif ${compact ? "text-[15px]" : "text-[17px]"} leading-tight tracking-[-0.005em] text-cream`}
              >
                {title}
              </span>
            </div>
            {subtitle ? (
              <AnimatePresence mode="wait">
                <motion.span
                  key={subtitle}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                  className={`max-w-[90%] ${compact ? "text-[11px]" : "text-[12px]"} leading-[1.35] text-cream/70`}
                >
                  {subtitle}…
                </motion.span>
              </AnimatePresence>
            ) : null}
          </div>
        ) : null}

        {/* Thin terracotta progress bar along the bottom */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-white/8"
          style={{ zIndex: 31 }}
        >
          <div
            className="h-full bg-terracotta"
            style={{
              width: `${Math.round(progress * 100)}%`,
              transition: "width 360ms ease-out",
              boxShadow: "0 0 12px rgba(198, 95, 61, 0.6)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CornerMarks() {
  const color = "rgba(250, 247, 240, 0.55)";
  const size = 12;
  const inset = 8;
  const thickness = 1;
  const corners: Array<{
    pos: React.CSSProperties;
    borders: React.CSSProperties;
  }> = [
    {
      pos: { top: inset, left: inset },
      borders: {
        borderTop: `${thickness}px solid ${color}`,
        borderLeft: `${thickness}px solid ${color}`,
      },
    },
    {
      pos: { top: inset, right: inset },
      borders: {
        borderTop: `${thickness}px solid ${color}`,
        borderRight: `${thickness}px solid ${color}`,
      },
    },
    {
      pos: { bottom: inset, left: inset },
      borders: {
        borderBottom: `${thickness}px solid ${color}`,
        borderLeft: `${thickness}px solid ${color}`,
      },
    },
    {
      pos: { bottom: inset, right: inset },
      borders: {
        borderBottom: `${thickness}px solid ${color}`,
        borderRight: `${thickness}px solid ${color}`,
      },
    },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            width: size,
            height: size,
            ...c.pos,
            ...c.borders,
            zIndex: 25,
          }}
        />
      ))}
    </>
  );
}

function SparkleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.6 5.6l2.1 2.1" />
      <path d="M16.3 16.3l2.1 2.1" />
      <path d="M5.6 18.4l2.1-2.1" />
      <path d="M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Hook to compute the sceneNames + count + allDone signals consumers care about
 * ------------------------------------------------------------------------- */

export function useStudioFrameSignals(results: TileResult[]) {
  return useMemo(() => {
    const visible = results.slice(0, MAX_VISIBLE_CARDS);
    const allDone =
      visible.length > 0 && visible.every((r) => r.status === "succeeded");
    return { visible, allDone };
  }, [results]);
}
