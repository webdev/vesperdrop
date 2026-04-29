import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { generateViaSceneify, SceneifyError } from "@/lib/ai/sceneify";
import { applyWatermark } from "@/lib/watermark";
import { storeWatermarked } from "@/lib/storage";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

// In-memory IP throttle. Survives across requests on Fluid Compute via instance reuse;
// good enough for MVP, replace with durable rate-limit when /try traffic warrants.
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 12;
const WINDOW_MS = 60_000;

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

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (!rateLimitOk(ip)) {
    return NextResponse.json(
      { error: "Too many previews. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  const sceneSlug = form.get("sceneSlug");

  const parsed = z
    .object({
      file: z.instanceof(File),
      sceneSlug: z.string().min(1).max(100),
    })
    .safeParse({ file, sceneSlug });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const { file: photo, sceneSlug: slug } = parsed.data;
  if (!photo.type.startsWith("image/")) {
    return NextResponse.json({ error: "expected an image" }, { status: 400 });
  }
  if (photo.size > 40 * 1024 * 1024) {
    return NextResponse.json({ error: "image too large (max 40MB)" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const key = `try-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let sourceUrl: string;
  if (env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`try/${key}`, photo, {
      access: "public",
      contentType: photo.type,
    });
    sourceUrl = blob.url;
  } else {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const safeName = photo.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const filename = `${key}-${safeName}`;
    await writeFile(path.join(dir, filename), Buffer.from(await photo.arrayBuffer()));
    sourceUrl = `${origin}/uploads/${filename}`;
  }

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

    const fetched = await fetch(result.outputUrl);
    if (!fetched.ok) throw new Error(`fetch generated image failed: ${fetched.status}`);
    const buf = Buffer.from(await fetched.arrayBuffer());
    const watermarked = await applyWatermark(buf, "VERCELDROP PREVIEW");
    const finalUrl = await storeWatermarked(watermarked, `${key}.png`, origin);

    return NextResponse.json({ outputUrl: finalUrl, sceneSlug: slug });
  } catch (e) {
    const status = e instanceof SceneifyError ? e.status : 502;
    const message = e instanceof Error ? e.message : "generation failed";
    const detail = e instanceof SceneifyError ? e.detail : undefined;
    console.error("[try/generate] sceneify failed", { status, message, detail });
    return NextResponse.json(
      { error: message, detail, sceneSlug: slug },
      { status },
    );
  }
}
