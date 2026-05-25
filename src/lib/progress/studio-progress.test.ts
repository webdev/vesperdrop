import { describe, it, expect } from "vitest";
import { deriveStudioProgress, TOTAL_EST_MS } from "./studio-progress";

describe("deriveStudioProgress", () => {
  it("maps the median stream phase onto the active timeline phase", () => {
    const out = deriveStudioProgress({
      medianPhaseId: "composing",
      slowestElapsedMs: 20_000,
      allDone: false,
    });
    expect(out.activePhase).toBe("composing");
    expect(out.activeIndex).toBe(2);
    expect(out.current.key).toBe("enhancing");
    expect(out.phases.map((p) => p.state)).toEqual([
      "done",
      "done",
      "active",
      "upcoming",
      "upcoming",
    ]);
  });

  it("defaults to the first phase before any stream phase lands", () => {
    const out = deriveStudioProgress({
      medianPhaseId: null,
      slowestElapsedMs: 0,
      allDone: false,
    });
    expect(out.activePhase).toBe("reading");
    expect(out.phases[0].state).toBe("active");
  });

  it("marks every phase done and clamps the timer when complete", () => {
    const out = deriveStudioProgress({
      medianPhaseId: "composing",
      slowestElapsedMs: 80_000,
      allDone: true,
    });
    expect(out.progress).toBe(1);
    expect(out.remainingMs).toBe(0);
    expect(out.remainingLabel).toBe("00:00");
    expect(out.phases.every((p) => p.state === "done")).toBe(true);
  });

  it("never lets progress fall behind the reached phase floor", () => {
    // elapsed is tiny but the stream is already at `matching` (index 3) —
    // progress must reflect the phase, not the clock.
    const out = deriveStudioProgress({
      medianPhaseId: "matching",
      slowestElapsedMs: 1_000,
      allDone: false,
    });
    expect(out.progress).toBeGreaterThanOrEqual(3 / 5);
  });

  it("derives the remaining timer off the slowest elapsed estimate", () => {
    const out = deriveStudioProgress({
      medianPhaseId: "reading",
      slowestElapsedMs: TOTAL_EST_MS - 12_000,
      allDone: false,
    });
    expect(out.remainingLabel).toBe("00:12");
    expect(out.remainingText).toBe("About 12 seconds remaining.");
  });
});
