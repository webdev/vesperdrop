import { describe, it, expect } from "vitest";
import { PHASES, phaseAtElapsed, pickLine, type PhaseId } from "./strings";

const preset = {
  slug: "linen-chair",
  name: "Linen Chair",
  mood: "calm",
  palette: ["#d8c9b8", "#735e4b"],
  category: "INTERIOR",
};
const attrs = { garment: "shirt", color: "navy", material: "linen", confidence: "high" as const };

describe("phaseAtElapsed", () => {
  it("returns reading at elapsed 0", () => {
    expect(phaseAtElapsed(0, 70_000)).toBe<PhaseId>("reading");
  });

  it("crosses each phase boundary correctly with default weights (.10/.15/.45/.20/.10)", () => {
    expect(phaseAtElapsed(7_001, 70_000)).toBe<PhaseId>("choosing");
    expect(phaseAtElapsed(17_501, 70_000)).toBe<PhaseId>("composing");
    expect(phaseAtElapsed(49_001, 70_000)).toBe<PhaseId>("matching");
    expect(phaseAtElapsed(63_001, 70_000)).toBe<PhaseId>("finishing");
  });

  it("pins at finishing past totalEstMs", () => {
    expect(phaseAtElapsed(120_000, 70_000)).toBe<PhaseId>("finishing");
  });

  it("weights sum to 1", () => {
    const sum = PHASES.reduce((a, p) => a + p.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("pickLine", () => {
  it("interpolates slot fills from attributes and preset", () => {
    const samples = Array.from({ length: 30 }, () => pickLine("reading", attrs, preset, []));
    expect(samples.some((s) => /navy|linen|shirt/.test(s))).toBe(true);
    samples.forEach((s) => expect(s).not.toMatch(/\{.*\}/));
  });

  it("collapses missing-attribute slots gracefully", () => {
    const out = pickLine("reading", null, preset, []);
    expect(out).not.toMatch(/\{.*\}/);
    expect(out).not.toMatch(/undefined/);
  });

  it("avoids the most-recent line when alternatives exist", () => {
    const phaseLines = PHASES.find((p) => p.id === "composing")!.lines;
    if (phaseLines.length < 2) return;
    const first = pickLine("composing", attrs, preset, []);
    const second = pickLine("composing", attrs, preset, [first]);
    expect(second).not.toBe(first);
  });

  it("prefers personal=true lines when attributes present", () => {
    const phase = PHASES.find((p) => p.id === "reading")!;
    const personalLines = phase.lines.filter((l) => l.personal);
    if (personalLines.length === 0) return;
    const samples = Array.from({ length: 20 }, () => pickLine("reading", attrs, preset, []));
    const personalCount = samples.filter((s) =>
      personalLines.some((p) => s.includes(p.template.replace(/\{[^}]+\}/g, "").trim().split(" ")[0])),
    ).length;
    expect(personalCount).toBeGreaterThan(0);
  });

  it("falls back to non-personal lines when attributes are null", () => {
    const samples = Array.from({ length: 10 }, () => pickLine("choosing", null, preset, []));
    samples.forEach((s) => {
      expect(s).not.toMatch(/\{garment\}|\{color\}|\{material\}/);
    });
  });
});
