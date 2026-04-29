import { put } from "@vercel/blob";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { generateViaSceneify, SceneifyError } from "@/lib/ai/sceneify";
import { extractAttributes } from "@/lib/ai/extract-attributes";
import { applyWatermark } from "@/lib/watermark";
import { storeWatermarked } from "@/lib/storage";
import { encodeSse } from "@/lib/progress/sse-encoder";
import { phaseAtElapsed, type PhaseId } from "@/lib/progress/strings";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 12;
const WINDOW_MS = 60_000;
const TOTAL_EST_MS = 70_000;

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || b.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_LIMIT) return false;
  b.count += 1;
  return true;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (!rateLimitOk(ip)) {
    return jsonError("Too many previews. Wait a minute and try again.", 429);
  }

  const form = await req.formData();
  const file = form.get("file");
  const sceneSlug = form.get("sceneSlug");

  const parsed = z
    .object({ file: z.instanceof(File), sceneSlug: z.string().min(1).max(100) })
    .safeParse({ file, sceneSlug });
  if (!parsed.success) return jsonError("invalid input", 400);

  const { file: photo, sceneSlug: slug } = parsed.data;
  if (!photo.type.startsWith("image/")) return jsonError("expected an image", 400);
  if (photo.size > 40 * 1024 * 1024) return jsonError("image too large (max 40MB)", 400);

  const origin = new URL(req.url).origin;
  const key = `try-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bytes = Buffer.from(await photo.arrayBuffer());

  let sourceUrl: string;
  if (env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`try/${key}`, bytes, { access: "public", contentType: photo.type });
    sourceUrl = blob.url;
  } else {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const safeName = photo.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const filename = `${key}-${safeName}`;
    await writeFile(path.join(dir, filename), bytes);
    sourceUrl = `${origin}/uploads/${filename}`;
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let lastPhase: PhaseId | null = null;
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encodeSse(event, data));
        } catch {
          closed = true;
        }
      };

      send("ready", { startedAt });

      const tickInterval = setInterval(() => {
        if (closed) return;
        const elapsedMs = Date.now() - startedAt;
        send("tick", { elapsedMs });
        const phase = phaseAtElapsed(elapsedMs, TOTAL_EST_MS);
        if (phase !== lastPhase) {
          lastPhase = phase;
          send("phase", { id: phase, elapsedMs, totalEstMs: TOTAL_EST_MS });
        }
      }, 1000);

      const attributesPromise = extractAttributes(bytes, photo.type)
        .then((attrs) => send("attributes", attrs))
        .catch(() => send("attributes", null));

      try {
        const result = await generateViaSceneify({
          sourceUrl,
          sourceFilename: photo.name,
          sourceMimeType: photo.type,
          presetSlug: slug,
          model: "gpt-image-2",
          quality: "medium",
          callerRef: `try-${key}`,
        });

        await attributesPromise;

        const fetched = await fetch(result.outputUrl);
        if (!fetched.ok) throw new Error(`fetch generated image failed: ${fetched.status}`);
        const buf = Buffer.from(await fetched.arrayBuffer());
        const watermarked = await applyWatermark(buf, "VERCELDROP PREVIEW");
        const finalUrl = await storeWatermarked(watermarked, `${key}.png`, origin);

        clearInterval(tickInterval);
        send("done", { outputUrl: finalUrl, sceneSlug: slug });
      } catch (e) {
        clearInterval(tickInterval);
        const status = e instanceof SceneifyError ? e.status : 502;
        const message = e instanceof Error ? e.message : "generation failed";
        const retryable = status >= 500;
        console.error("[try/generate] sceneify failed", { status, message });
        send("error", { message, retryable });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
