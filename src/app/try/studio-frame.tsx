/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo } from "react";
import type { StudioProgress } from "@/lib/progress/studio-progress";
import type { TileResult } from "./develop-grid";
import { EmailContinuationModule } from "./email-continuation";

const MAX_VISIBLE_CARDS = 6;

type Props = {
  results: TileResult[];
  sourceUrl?: string;
  sourceName?: string;
  sceneNames: string[];
  /** True after all results have streamed in. */
  allDone: boolean;
  /**
   * Real streamed progress derived once in <ProgressScreen /> via
   * `deriveStudioProgress`. Drives the render clarity, the bottom 5-phase
   * timeline, the progress line, the timer and the sidebar checklist — one
   * source of truth, no second fake countdown (VES-43/44).
   */
  progress?: StudioProgress;
  /**
   * Optional grid renderer (legacy / persisted-batch reuse path). When set
   * the redesigned cinematic frame is bypassed in favour of the supplied
   * tiles. Kept for backward-compatibility; the live /try developing state
   * does NOT pass it.
   */
  renderGrid?: (args: { results: TileResult[]; count: number }) => React.ReactNode;
  /**
   * Email-during-generation wiring (VES-45). The client-minted batch token
   * is the durable key the server stashes a mid-generation email against
   * (run isn't finalized yet); `pickedScenes` (scene slugs) + `sourceUrl`
   * are recorded on the try_intents ads record. When omitted (e.g. legacy
   * grid path) the module still renders but the submit is disabled until a
   * token/runId exists.
   */
  emailToken?: string;
  pickedScenes?: string[];
  /** Fired once when the mid-generation email module captures (VES-45). */
  onEmailCaptured?: () => void;
};

/**
 * Cinematic "In the studio." Develop step — desktop art direction
 * (VES-43 render frame + bottom timeline, VES-44 sidebar).
 *
 * Layout (desktop): a constrained wide editorial spread —
 *   [ ~280px studio sidebar ][ dominant ~16:9 render frame ]
 *   [ email module slot (VES-45) ][ 5-phase progress timeline ]
 *
 * §2 note: the /try page is wrapped in `Container width="app"` (1180px).
 * The mock is a wide two-column spread, so this component opts the develop
 * step up to a documented constrained 1320px max-width (still centred, NOT
 * edge-to-edge) — see `STUDIO_MAX_WIDTH`.
 *
 * All progress/timer/phase state comes from `progress` (real streamed
 * data). The same `StudioSidebarData` shape is exposed so VES-47 can build
 * the mobile strip from identical data without re-deriving anything.
 */

/** Documented wide max-width for the develop spread (§2). */
const STUDIO_MAX_WIDTH = 1320;

export type StudioSidebarData = {
  sourceUrl?: string;
  sourceName?: string;
  /** Active scene name (first picked scene). */
  sceneName: string;
  /** Number of images developing in this batch. */
  count: number;
  remainingLabel: string;
  remainingText: string;
};

export function StudioDevelopFrame({
  results,
  sourceUrl,
  sourceName,
  sceneNames,
  allDone,
  progress,
  renderGrid,
  emailToken,
  pickedScenes,
  onEmailCaptured,
}: Props) {
  const visible = results.slice(0, MAX_VISIBLE_CARDS);
  const count = visible.length;
  const activeTile = visible[0];
  const sceneName = sceneNames[0] ?? activeTile?.sceneName ?? "Your scene";

  // Output of the active tile once it lands — we cross-fade the
  // progressively-clarifying preview into the finished render.
  const outputUrl = activeTile?.status === "succeeded" ? activeTile.outputUrl : undefined;

  const sidebar: StudioSidebarData = {
    sourceUrl,
    sourceName,
    sceneName,
    count,
    remainingLabel: progress?.remainingLabel ?? "00:58",
    remainingText: progress?.remainingText ?? "About 58 seconds remaining.",
  };

  // Legacy renderGrid path (persisted-batch reuse) — keep the simple shell.
  if (renderGrid) {
    return (
      <section data-testid="studio-frame" data-count={count} className="relative">
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[240px_1fr] md:gap-12">
          <StudioSidebar
            sidebar={sidebar}
            allDone={allDone}
            phases={progress?.phases}
          />
          <div className="min-w-0">{renderGrid({ results: visible, count })}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="studio-frame"
      data-count={count}
      className="relative mx-auto w-full"
      style={{ maxWidth: STUDIO_MAX_WIDTH }}
    >
      {/* Warm radial atmosphere behind the spread */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 70% 22%, rgba(244, 226, 216, 0.5) 0%, transparent 72%), radial-gradient(120% 80% at 50% 100%, rgba(234, 208, 195, 0.28) 0%, transparent 72%)",
        }}
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
        {/* Left studio sidebar (VES-44) */}
        <StudioSidebar
          sidebar={sidebar}
          allDone={allDone}
          phases={progress?.phases}
        />

        {/* Right column: render frame (VES-43) */}
        <div className="min-w-0">
          <RenderFrame
            sourceUrl={sourceUrl}
            sceneName={sceneName}
            index={0}
            total={count || 1}
            outputUrl={outputUrl}
            allDone={allDone}
            progress={progress}
          />
        </div>
      </div>

      {/* Bottom full-width strip: email module (VES-45) + 5-phase timeline (VES-43).
          The email-during-generation module is an unauth conversion surface —
          it mounts only when a batch token exists (unauth flow). Authed
          visitors receive HD output directly and skip the email gate, so the
          timeline spans the strip alone. */}
      <div
        className={`mt-6 grid grid-cols-1 gap-5 md:mt-8 lg:items-stretch lg:gap-6 ${
          emailToken ? "lg:grid-cols-[1fr_minmax(420px,0.85fr)]" : ""
        }`}
      >
        {emailToken ? (
          <EmailContinuationModule
            token={emailToken}
            pickedScenes={pickedScenes}
            sourceUrl={sourceUrl}
            onCaptured={onEmailCaptured}
          />
        ) : null}
        <PhaseTimeline phases={progress?.phases} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Left studio sidebar (VES-44)
 * ------------------------------------------------------------------------- */

function StudioSidebar({
  sidebar,
  allDone,
  phases,
}: {
  sidebar: StudioSidebarData;
  allDone: boolean;
  phases?: StudioProgress["phases"];
}) {
  const { sourceUrl, sourceName, sceneName, count, remainingLabel, remainingText } = sidebar;

  return (
    <aside className="flex flex-col gap-6" data-testid="studio-left-rail">
      {/* Mono label + serif headline + subtext */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
          Developing · N°03
        </p>
        <h2 className="mt-3 font-serif text-[clamp(2rem,3.4vw,2.85rem)] leading-[1.02] tracking-[-0.02em] text-ink">
          In the{" "}
          <em className="not-italic italic text-terracotta-dark">studio</em>.
        </h2>
        <p className="mt-3 text-[13.5px] leading-[1.45] text-ink-3">
          Your first campaign is being prepared.
        </p>
      </div>

      {/* Product reference card + scene chip */}
      <div
        className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-subtle"
        data-testid="studio-product-card"
      >
        <div className="aspect-square w-full overflow-hidden bg-paper-soft">
          {sourceUrl ? (
            <img
              src={sourceUrl}
              alt={sourceName ?? "Your product"}
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
              No product
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-3.5 py-3">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-4">
            Scene
          </span>
          <span
            className="inline-flex items-center rounded-full border border-terracotta/30 bg-terracotta-wash px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta-dark"
            data-testid="studio-scene-chip"
          >
            {sceneName}
          </span>
        </div>
      </div>

      {/* Generation status card */}
      <div
        className="flex items-center gap-2.5 rounded-xl border border-line-soft bg-cream px-4 py-3.5 shadow-subtle"
        data-testid="studio-status-card"
      >
        <span aria-hidden className="relative flex h-2.5 w-2.5 shrink-0">
          {!allDone ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta/60" />
          ) : null}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-terracotta" />
        </span>
        <p className="text-[13px] leading-[1.35] text-ink-2">
          <span className="font-medium text-ink">{count}</span> campaign image
          {count === 1 ? "" : "s"} {allDone ? "ready" : "developing"}
        </p>
      </div>

      <div className="border-t border-line-soft" />

      {/* Timer */}
      <div data-testid="studio-timer">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-4">
          Est. time remaining
        </p>
        <p className="mt-1.5 font-serif text-[2.4rem] leading-none tracking-[-0.01em] text-ink tabular-nums">
          {remainingLabel}
        </p>
        <p className="mt-1.5 text-[12px] leading-[1.4] text-ink-3">{remainingText}</p>
      </div>

      {/* Vertical phase checklist */}
      <SidebarChecklist phases={phases} />

      {/* Reassurance line */}
      <p className="text-[12px] leading-[1.5] text-ink-3">
        You&apos;ll be notified when it&apos;s ready.
      </p>
    </aside>
  );
}

function SidebarChecklist({ phases }: { phases?: StudioProgress["phases"] }) {
  // Sidebar shows a 4-item editorial checklist (mock); we collapse the
  // 5 timeline phases into the 4 sidebar steps, mapping rendering+finalizing
  // onto "Preparing high-res output".
  const items = useMemo(() => {
    const fallback = [
      { label: "Mapping garment silhouette", state: "active" as const },
      { label: "Analyzing composition", state: "upcoming" as const },
      { label: "Balancing tones", state: "upcoming" as const },
      { label: "Preparing high-res output", state: "upcoming" as const },
    ];
    if (!phases) return fallback;
    const stateOf = (
      keys: string[],
    ): "done" | "active" | "upcoming" => {
      const matched = phases.filter((p) => keys.includes(p.key));
      if (matched.some((p) => p.state === "active")) return "active";
      if (matched.length > 0 && matched.every((p) => p.state === "done"))
        return "done";
      return "upcoming";
    };
    return [
      { label: "Mapping garment silhouette", state: stateOf(["mapping"]) },
      { label: "Analyzing composition", state: stateOf(["analyzing"]) },
      { label: "Balancing tones", state: stateOf(["enhancing"]) },
      {
        label: "Preparing high-res output",
        state: stateOf(["rendering", "finalizing"]),
      },
    ];
  }, [phases]);

  return (
    <ul className="flex flex-col gap-3" data-testid="studio-checklist">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2.5">
          <StepDot state={item.state} />
          <span
            className={`text-[12.5px] leading-tight ${
              item.state === "upcoming"
                ? "text-ink-4"
                : item.state === "done"
                  ? "text-ink-3"
                  : "font-medium text-ink"
            }`}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StepDot({ state }: { state: "done" | "active" | "upcoming" }) {
  if (state === "done") {
    return (
      <span
        aria-hidden
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-terracotta text-cream"
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span aria-hidden className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <span className="absolute h-4 w-4 animate-ping rounded-full bg-terracotta/40" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-terracotta shadow-[0_0_8px_rgba(198,95,61,0.6)]" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-4 w-4 shrink-0 items-center justify-center"
    >
      <span className="h-2.5 w-2.5 rounded-full border border-line bg-transparent" />
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Render frame (VES-43)
 * ------------------------------------------------------------------------- */

function RenderFrame({
  sourceUrl,
  sceneName,
  index,
  total,
  outputUrl,
  allDone,
  progress,
}: {
  sourceUrl?: string;
  sceneName: string;
  index: number;
  total: number;
  outputUrl?: string;
  allDone: boolean;
  progress?: StudioProgress;
}) {
  const pct = progress?.progress ?? 0;
  const isDone = allDone && Boolean(outputUrl);

  // Progressive clarity tied to real progress: as the render advances the
  // blur/haze recede, sharpening creeps in. NOT a static blur, NOT a spinner.
  const blurPx = isDone ? 0 : Math.max(2, 26 - pct * 24);
  const grainOpacity = isDone ? 0 : 0.16 - pct * 0.1;
  const overlayTitle = isDone
    ? "Ready"
    : (progress?.current.overlayTitle ?? "Mapping silhouette");
  const overlaySubtitle = isDone
    ? "Your campaign image is ready"
    : (progress?.current.overlaySubtitle ?? "Reading shape and proportions");

  return (
    <figure
      className="relative w-full overflow-hidden rounded-[32px] bg-[#1f1c19] shadow-card"
      data-testid="studio-render-frame"
      style={{
        boxShadow:
          "0 24px 60px -24px rgba(31,28,25,0.45), inset 0 0 0 1px rgba(250,247,240,0.06), inset 0 2px 40px rgba(0,0,0,0.35)",
      }}
    >
      <div className="relative aspect-[16/10] w-full">
        {/* Progressively-clarifying preview (user's product) */}
        {sourceUrl ? (
          <img
            src={sourceUrl}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              filter: `blur(${blurPx}px) saturate(${isDone ? 1 : 0.82}) brightness(${isDone ? 1 : 0.72})`,
              transform: isDone ? "scale(1)" : "scale(1.06)",
              opacity: isDone ? 0 : 0.92,
              transition:
                "filter 700ms cubic-bezier(0.2,0.8,0.2,1), transform 700ms cubic-bezier(0.2,0.8,0.2,1), opacity 600ms ease-out",
            }}
          />
        ) : null}

        {/* Finished render fades in */}
        {outputUrl && isDone ? (
          <img
            src={outputUrl}
            alt={sceneName}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: 1, transition: "opacity 800ms ease-out" }}
          />
        ) : null}

        {/* Animated film grain */}
        {!isDone ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-overlay studio-grain"
            style={{ opacity: Math.max(0, grainOpacity) }}
          />
        ) : null}

        {/* Slow diagonal light sweep */}
        {!isDone ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="studio-sweep absolute -inset-y-10 -left-1/3 w-1/3 rotate-[18deg] bg-gradient-to-r from-transparent via-white/12 to-transparent" />
          </div>
        ) : null}

        {/* Cinematic vignette / gradient for legibility */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,12,10,0.30) 0%, rgba(15,12,10,0.05) 30%, rgba(15,12,10,0.10) 60%, rgba(15,12,10,0.60) 100%)",
          }}
        />

        <CornerMarks />

        {/* Top-left pill: 01 / 01 · WARM RETREAT */}
        <div
          className="absolute left-4 top-4 inline-flex items-center rounded-full bg-black/55 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cream backdrop-blur-sm"
          style={{ zIndex: 30 }}
          data-testid="render-scene-pill"
        >
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} · {sceneName}
        </div>

        {/* Top-right: AI DARKROOM / HIGH RES */}
        <div
          className="absolute right-4 top-4 flex flex-col items-end gap-1"
          style={{ zIndex: 30 }}
        >
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-cream/85">
            AI Darkroom
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-cream/55">
            High Res
          </span>
        </div>

        {/* Bottom-left current-step overlay */}
        <div
          className="absolute bottom-5 left-5 right-5 flex flex-col gap-1"
          style={{ zIndex: 30 }}
          data-testid="render-step-overlay"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden className={`text-terracotta-soft ${isDone ? "" : "studio-pulse"}`}>
              <SparkleIcon size={15} />
            </span>
            <span className="font-serif text-[18px] leading-tight tracking-[-0.005em] text-cream">
              {overlayTitle}
            </span>
          </div>
          <span className="max-w-[80%] text-[12.5px] leading-[1.35] text-cream/70">
            {overlaySubtitle}…
          </span>
        </div>

        {/* Floating DETAIL PREVIEW inset */}
        {sourceUrl ? (
          <div
            className="absolute bottom-5 right-5 hidden w-[112px] overflow-hidden rounded-xl border border-cream/15 bg-black/30 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:block"
            style={{ zIndex: 30 }}
            data-testid="detail-preview"
          >
            <div className="aspect-square w-full overflow-hidden">
              <img
                src={sourceUrl}
                alt=""
                aria-hidden
                draggable={false}
                className="h-full w-full scale-[1.8] object-cover"
                style={{ filter: `blur(${Math.max(0, blurPx * 0.4)}px)` }}
              />
            </div>
            <div className="px-2 py-1.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-cream/70">
                Detail Preview
              </span>
            </div>
          </div>
        ) : null}

        {/* Bottom animated terracotta progress line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-white/10"
          style={{ zIndex: 31 }}
        >
          <div
            className="h-full bg-terracotta"
            style={{
              width: `${Math.round(pct * 100)}%`,
              transition: "width 500ms ease-out",
              boxShadow: "0 0 12px rgba(198, 95, 61, 0.7)",
            }}
          />
        </div>
      </div>
    </figure>
  );
}

/* ---------------------------------------------------------------------------
 * Bottom 5-phase progress timeline (VES-43)
 * ------------------------------------------------------------------------- */

function PhaseTimeline({ phases }: { phases?: StudioProgress["phases"] }) {
  const items =
    phases ??
    ([
      { key: "mapping", label: "Mapping", description: "Garment silhouette", state: "active" },
      { key: "analyzing", label: "Analyzing", description: "Composition & pose", state: "upcoming" },
      { key: "enhancing", label: "Enhancing", description: "Textures & lighting", state: "upcoming" },
      { key: "rendering", label: "Rendering", description: "High-res output", state: "upcoming" },
      { key: "finalizing", label: "Finalizing", description: "Preparing your image", state: "upcoming" },
    ] as StudioProgress["phases"]);

  return (
    <div
      className="rounded-2xl border border-line-soft bg-surface px-5 py-5 shadow-subtle"
      data-testid="studio-timeline"
    >
      <div className="relative grid grid-cols-5 gap-2">
        {/* connecting line */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[10%] right-[10%] top-[7px] h-px bg-line"
        />
        {items.map((p) => (
          <div key={p.key} className="relative flex flex-col items-center gap-2 text-center">
            <StepDot state={p.state} />
            <div>
              <p
                className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                  p.state === "upcoming"
                    ? "text-ink-4"
                    : p.state === "active"
                      ? "text-terracotta-dark"
                      : "text-ink-2"
                }`}
              >
                {p.label}
              </p>
              <p className="mt-0.5 text-[10.5px] leading-tight text-ink-4">{p.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Corner registration ticks
 * ------------------------------------------------------------------------- */

function CornerMarks() {
  const color = "rgba(250, 247, 240, 0.5)";
  const size = 16;
  const inset = 14;
  const thickness = 1;
  const corners: Array<{ pos: React.CSSProperties; borders: React.CSSProperties }> = [
    {
      pos: { top: inset, left: inset },
      borders: { borderTop: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}` },
    },
    {
      pos: { top: inset, right: inset },
      borders: { borderTop: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` },
    },
    {
      pos: { bottom: inset, left: inset },
      borders: { borderBottom: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}` },
    },
    {
      pos: { bottom: inset, right: inset },
      borders: { borderBottom: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` },
    },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute"
          style={{ width: size, height: size, ...c.pos, ...c.borders, zIndex: 25 }}
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
 * Signals helper (unchanged API)
 * ------------------------------------------------------------------------- */

export function useStudioFrameSignals(results: TileResult[]) {
  return useMemo(() => {
    const visible = results.slice(0, MAX_VISIBLE_CARDS);
    const allDone =
      visible.length > 0 && visible.every((r) => r.status === "succeeded");
    return { visible, allDone };
  }, [results]);
}
