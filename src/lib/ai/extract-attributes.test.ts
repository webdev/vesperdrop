import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
}));
vi.mock("ai", () => ({ generateObject: generateObjectMock }));

import { extractAttributes, _resetCacheForTest } from "./extract-attributes";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xee]);

describe("extractAttributes", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    _resetCacheForTest();
  });
  afterEach(() => vi.useRealTimers());

  it("returns the parsed attributes on a high-confidence response", async () => {
    generateObjectMock.mockResolvedValue({
      object: { garment: "shirt", color: "navy", material: "linen", confidence: "high" },
    });
    const out = await extractAttributes(png, "image/png");
    expect(out).toEqual({ garment: "shirt", color: "navy", material: "linen", confidence: "high" });
  });

  it("returns null when the model reports low confidence", async () => {
    generateObjectMock.mockResolvedValue({
      object: { garment: "?", color: "?", material: "?", confidence: "low" },
    });
    const out = await extractAttributes(png, "image/png");
    expect(out).toBeNull();
  });

  it("returns null when the model throws", async () => {
    generateObjectMock.mockRejectedValue(new Error("boom"));
    const out = await extractAttributes(png, "image/png");
    expect(out).toBeNull();
  });

  it("caches by sha256 and does not re-call on second invocation with same bytes", async () => {
    generateObjectMock.mockResolvedValue({
      object: { garment: "shirt", color: "navy", material: "linen", confidence: "high" },
    });
    await extractAttributes(png, "image/png");
    await extractAttributes(png, "image/png");
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on transient failure", async () => {
    generateObjectMock
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({
        object: { garment: "shirt", color: "navy", material: "linen", confidence: "high" },
      });
    const out = await extractAttributes(png, "image/png");
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(out?.garment).toBe("shirt");
  });
});
