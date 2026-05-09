import { put } from "@vercel/blob";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    return jsonError("Too many uploads. Wait a minute and try again.", 429);
  }

  const form = await req.formData();
  const file = form.get("file");
  const parsed = z.object({ file: z.instanceof(File) }).safeParse({ file });
  if (!parsed.success) return jsonError("invalid input", 400);

  const photo = parsed.data.file;
  if (!photo.type.startsWith("image/")) return jsonError("expected an image", 400);
  if (photo.size > 40 * 1024 * 1024) return jsonError("image too large (max 40MB)", 400);

  const origin = new URL(req.url).origin;
  const key = `try-src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bytes = Buffer.from(await photo.arrayBuffer());

  let sourceUrl: string;
  if (env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`try/${key}`, bytes, {
      access: "public",
      contentType: photo.type,
    });
    sourceUrl = blob.url;
  } else {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const safeName = photo.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const filename = `${key}-${safeName}`;
    await writeFile(path.join(dir, filename), bytes);
    sourceUrl = `${origin}/uploads/${filename}`;
  }

  return new Response(
    JSON.stringify({
      sourceUrl,
      name: photo.name,
      mimeType: photo.type,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
