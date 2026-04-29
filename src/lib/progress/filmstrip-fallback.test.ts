import { describe, it, expect } from "vitest";
import { filmstripFor } from "./filmstrip-fallback";

describe("filmstripFor", () => {
  it("returns 5 paths for known categories (case-insensitive)", () => {
    for (const c of ["EXTERIOR", "interior", "Street", "STUDIO"]) {
      const out = filmstripFor(c);
      expect(out).toHaveLength(5);
      expect(out[0]).toMatch(/^\/filmstrip\/.+\/01\.jpg$/);
    }
  });

  it("falls back to default for unknown category", () => {
    expect(filmstripFor("aurora")[0]).toContain("/filmstrip/default/");
  });

  it("falls back to default for null/undefined", () => {
    expect(filmstripFor(null)[0]).toContain("/filmstrip/default/");
    expect(filmstripFor(undefined)[0]).toContain("/filmstrip/default/");
  });
});
