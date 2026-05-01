import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { applyWatermark } from "./watermark";

describe("applyWatermark", () => {
  it("returns a buffer with the same dimensions as the input", async () => {
    const input = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#888" },
    }).png().toBuffer();
    const out = await applyWatermark(input, "VESPERDROP PREVIEW");
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });
});
