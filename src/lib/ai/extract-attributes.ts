import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { generateObject } from "ai";

export type ExtractedAttributes = {
  garment: string;
  color: string;
  material: string;
  cut?: string;
  pattern?: string;
  confidence: "high" | "medium" | "low";
};

const schema = z.object({
  garment: z.string().min(1).max(60),
  color: z.string().min(1).max(40),
  material: z.string().min(1).max(40),
  cut: z.string().max(40).optional(),
  pattern: z.string().max(40).optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

const cache = new Map<string, { value: ExtractedAttributes | null; expiresAt: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

export function _resetCacheForTest() {
  cache.clear();
}

export async function extractAttributes(
  bytes: Buffer,
  mimeType: string,
): Promise<ExtractedAttributes | null> {
  const key = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const result = await runWithRetry(bytes, mimeType);
  cache.set(key, { value: result, expiresAt: now + TTL_MS });
  return result;
}

async function runWithRetry(bytes: Buffer, mimeType: string): Promise<ExtractedAttributes | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: "google/gemini-2.5-flash",
        schema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "You are looking at a flatlay or product photo. Extract structured attributes about the primary garment or product. Be terse: short noun phrases for color/material, not sentences. If the photo is ambiguous or contains no clear product, set confidence to 'low'.",
              },
              { type: "image", image: bytes, mediaType: mimeType },
            ],
          },
        ],
        abortSignal: AbortSignal.timeout(4000),
      });

      if (object.confidence === "low") return null;
      return object;
    } catch (e) {
      if (attempt === 1) {
        console.error("[extractAttributes] failed", { message: String(e) });
        return null;
      }
    }
  }
  return null;
}
