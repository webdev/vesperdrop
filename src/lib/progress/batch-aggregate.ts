import { PHASES, type PhaseId } from "./strings";

export type StreamStatus = "idle" | "connecting" | "streaming" | "done" | "error";

export type StreamSnapshot = {
  status: StreamStatus;
  phaseId: PhaseId | null;
  outputUrl: string | null;
  error: { message: string; retryable: boolean } | null;
  elapsedMs: number;
};

export type BatchAggregate = {
  medianPhaseId: PhaseId | null;
  doneCount: number;
  totalCount: number;
  allDone: boolean;
  allFailed: boolean;
  showCounter: boolean;
  slowestElapsedMs: number;
};

const PHASE_ORDER: PhaseId[] = PHASES.map((p) => p.id);

export function aggregateBatch(streams: StreamSnapshot[]): BatchAggregate {
  const total = streams.length;
  const doneCount = streams.filter((s) => s.status === "done").length;
  const errorCount = streams.filter((s) => s.status === "error").length;

  const active = streams.filter((s) => s.status !== "done" && s.status !== "error");
  const phasePool = active.length > 0 ? active : streams;

  const phaseIndices = phasePool
    .map((s) => (s.phaseId ? PHASE_ORDER.indexOf(s.phaseId) : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);

  let medianPhaseId: PhaseId | null = null;
  if (phaseIndices.length > 0) {
    const mid = Math.floor(phaseIndices.length / 2);
    medianPhaseId = PHASE_ORDER[phaseIndices[mid]];
  }

  const slowestElapsedMs = active.length > 0
    ? Math.max(...active.map((s) => s.elapsedMs))
    : Math.max(0, ...streams.map((s) => s.elapsedMs));

  return {
    medianPhaseId,
    doneCount,
    totalCount: total,
    allDone: total > 0 && doneCount === total,
    allFailed: total > 0 && errorCount === total,
    showCounter: doneCount > 0,
    slowestElapsedMs,
  };
}
