import { describe, it, expect } from "vitest";
import { aggregateBatch, type StreamSnapshot } from "./batch-aggregate";

const s = (overrides: Partial<StreamSnapshot> = {}): StreamSnapshot => ({
  status: "streaming",
  phaseId: "composing",
  outputUrl: null,
  error: null,
  elapsedMs: 0,
  ...overrides,
});

describe("aggregateBatch", () => {
  it("counts done streams", () => {
    const out = aggregateBatch([
      s({ status: "done", outputUrl: "a" }),
      s({ status: "done", outputUrl: "b" }),
      s(),
    ]);
    expect(out.doneCount).toBe(2);
    expect(out.totalCount).toBe(3);
    expect(out.allDone).toBe(false);
  });

  it("sets allDone when every stream is done", () => {
    const out = aggregateBatch([
      s({ status: "done", outputUrl: "a" }),
      s({ status: "done", outputUrl: "b" }),
    ]);
    expect(out.allDone).toBe(true);
    expect(out.allFailed).toBe(false);
  });

  it("sets allFailed when every stream errored", () => {
    const out = aggregateBatch([
      s({ status: "error", error: { message: "x", retryable: true } }),
      s({ status: "error", error: { message: "y", retryable: true } }),
    ]);
    expect(out.allDone).toBe(false);
    expect(out.allFailed).toBe(true);
  });

  it("computes median phase across active streams (skips done/error)", () => {
    const out = aggregateBatch([
      s({ phaseId: "reading" }),
      s({ phaseId: "composing" }),
      s({ phaseId: "matching" }),
      s({ status: "done", outputUrl: "a" }),
      s({ status: "error", error: { message: "x", retryable: false } }),
    ]);
    expect(out.medianPhaseId).toBe("composing");
  });

  it("falls back to lowest non-null phase when all streams are done", () => {
    const out = aggregateBatch([
      s({ status: "done", phaseId: "finishing", outputUrl: "a" }),
      s({ status: "done", phaseId: "finishing", outputUrl: "b" }),
    ]);
    expect(out.medianPhaseId).toBe("finishing");
  });

  it("returns null medianPhaseId when no phases reported yet", () => {
    const out = aggregateBatch([s({ phaseId: null }), s({ phaseId: null })]);
    expect(out.medianPhaseId).toBeNull();
  });

  it("showCounter true once at least one is done", () => {
    expect(aggregateBatch([s(), s()]).showCounter).toBe(false);
    expect(
      aggregateBatch([s({ status: "done", outputUrl: "a" }), s()]).showCounter,
    ).toBe(true);
  });

  it("slowestElapsedMs is the max elapsed of streaming streams", () => {
    const out = aggregateBatch([
      s({ elapsedMs: 12_000 }),
      s({ elapsedMs: 45_000 }),
      s({ status: "done", elapsedMs: 70_000, outputUrl: "a" }),
    ]);
    expect(out.slowestElapsedMs).toBe(45_000);
  });
});
