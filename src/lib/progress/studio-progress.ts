import type { PhaseId } from "./strings";

/**
 * Shared studio-progress derivation for the cinematic "In the studio."
 * Develop step (VES-42 family).
 *
 * Both the desktop render frame (VES-43) and the desktop sidebar (VES-44)
 * — and later the mobile strip / vertical timeline (VES-47) — drive ALL of
 * their visible progress state (clarity, timeline phase, timer) off this
 * single derivation so there is never a second fake countdown. The inputs
 * are the real streamed signals from `useProgressBatch` (`medianPhaseId`,
 * `slowestElapsedMs`, `doneCount`, `allDone`).
 */

export const TOTAL_EST_MS = 70_000;

/** The five cinematic timeline phases, in order. */
export type StudioPhaseKey =
  | "mapping"
  | "analyzing"
  | "enhancing"
  | "rendering"
  | "finalizing";

export type StudioPhaseState = "done" | "active" | "upcoming";

export type StudioPhase = {
  key: StudioPhaseKey;
  /** Short label shown in the bottom timeline + sidebar checklist. */
  label: string;
  /** Tiny description under the label in the bottom timeline. */
  description: string;
  /** Current-step overlay copy shown over the render frame. */
  overlayTitle: string;
  overlaySubtitle: string;
  state: StudioPhaseState;
};

/**
 * The 5 cinematic phases map onto the 5 real stream phases 1:1
 * (`reading → choosing → composing → matching → finishing`). We keep the
 * editorial labels stable in this module so every surface agrees.
 */
const PHASE_DEFS: Array<{
  key: StudioPhaseKey;
  streamPhase: PhaseId;
  label: string;
  description: string;
  overlayTitle: string;
  overlaySubtitle: string;
}> = [
  {
    key: "mapping",
    streamPhase: "reading",
    label: "Mapping",
    description: "Garment silhouette",
    overlayTitle: "Mapping silhouette",
    overlaySubtitle: "Reading shape and proportions",
  },
  {
    key: "analyzing",
    streamPhase: "choosing",
    label: "Analyzing",
    description: "Composition & pose",
    overlayTitle: "Analyzing composition",
    overlaySubtitle: "Setting the scene and pose",
  },
  {
    key: "enhancing",
    streamPhase: "composing",
    label: "Enhancing",
    description: "Textures & lighting",
    overlayTitle: "Sharpening details",
    overlaySubtitle: "Enhancing textures and lighting",
  },
  {
    key: "rendering",
    streamPhase: "matching",
    label: "Rendering",
    description: "High-res output",
    overlayTitle: "Rendering high-res",
    overlaySubtitle: "Balancing tones and contrast",
  },
  {
    key: "finalizing",
    streamPhase: "finishing",
    label: "Finalizing",
    description: "Preparing your image",
    overlayTitle: "Finalizing image",
    overlaySubtitle: "Preparing your high-res photo",
  },
];

const PHASE_ORDER: PhaseId[] = [
  "reading",
  "choosing",
  "composing",
  "matching",
  "finishing",
];

export type StudioProgressInput = {
  medianPhaseId: PhaseId | null;
  slowestElapsedMs: number;
  allDone: boolean;
};

export type StudioProgress = {
  /** 0..1 overall completion, monotonic-ish, derived from real elapsed. */
  progress: number;
  /** Active stream phase (median across in-flight scenes). */
  activePhase: PhaseId;
  /** Index of the active phase in [0,4]. */
  activeIndex: number;
  /** Milliseconds remaining (clamped ≥ 0). */
  remainingMs: number;
  /** `MM:SS` of remaining time. */
  remainingLabel: string;
  /** Human "About N seconds remaining." line. */
  remainingText: string;
  /** The 5 phases with computed done/active/upcoming state. */
  phases: StudioPhase[];
  /** Convenience: the currently-active phase definition. */
  current: StudioPhase;
};

function phaseIndex(phase: PhaseId): number {
  const i = PHASE_ORDER.indexOf(phase);
  return i < 0 ? 0 : i;
}

export function deriveStudioProgress({
  medianPhaseId,
  slowestElapsedMs,
  allDone,
}: StudioProgressInput): StudioProgress {
  const activePhase: PhaseId = allDone
    ? "finishing"
    : (medianPhaseId ?? "reading");
  const activeIndex = phaseIndex(activePhase);

  // Progress blends a time-based estimate with the discrete phase floor so
  // the bar always advances even before the first phase event lands, but
  // never sits behind the phase the stream has actually reached.
  const timeProgress = Math.min(0.96, slowestElapsedMs / TOTAL_EST_MS);
  const phaseFloor = activeIndex / PHASE_ORDER.length;
  const progress = allDone
    ? 1
    : Math.min(0.98, Math.max(timeProgress, phaseFloor));

  const remainingMs = allDone
    ? 0
    : Math.max(0, TOTAL_EST_MS - slowestElapsedMs);
  const mins = Math.floor(remainingMs / 60_000);
  const secs = Math.floor((remainingMs % 60_000) / 1000);
  const remainingLabel = allDone
    ? "00:00"
    : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const totalSecs = Math.round(remainingMs / 1000);
  const remainingText = allDone
    ? "Almost ready…"
    : totalSecs > 0
      ? `About ${totalSecs} seconds remaining.`
      : "Wrapping up…";

  const phases: StudioPhase[] = PHASE_DEFS.map((def, i) => ({
    key: def.key,
    label: def.label,
    description: def.description,
    overlayTitle: def.overlayTitle,
    overlaySubtitle: def.overlaySubtitle,
    state: allDone
      ? "done"
      : i < activeIndex
        ? "done"
        : i === activeIndex
          ? "active"
          : "upcoming",
  }));

  return {
    progress,
    activePhase,
    activeIndex,
    remainingMs,
    remainingLabel,
    remainingText,
    phases,
    current: phases[activeIndex] ?? phases[0],
  };
}
