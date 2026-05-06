import { describe, it, expect } from "vitest";
import { generatePreviewToken } from "./tokens";

describe("generatePreviewToken", () => {
  it("returns a 43-char URL-safe base64 string", () => {
    const t = generatePreviewToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns a different token each call", () => {
    const set = new Set(Array.from({ length: 50 }, () => generatePreviewToken()));
    expect(set.size).toBe(50);
  });
});
