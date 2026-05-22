import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { tryIntents, generations, runs } from "@/lib/db/schema";
import { sendPhotosEmail } from "@/lib/email/send-photo";
import { env } from "@/lib/env";

// Inline /try email capture: visitor types email below their watermarked
// previews, hits "Send me my photo", we deliver ALL three watermark-free
// HD versions of the scenes they previewed (the locked free-tier rule
// changed 2026-05-18 — see CLAUDE.md §15a). No account creation, no OTP.
// Pixel `Lead` fires CLIENT-SIDE after this returns 200 so the event is
// server-confirmed.

export const runtime = "nodejs";

const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60_000;

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

const BodySchema = z.object({
  email: z.string().email().max(254),
  runId: z.string().uuid(),
});

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (!rateLimitOk(ip)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many emails. Try again in an hour." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", message: parsed.error.message },
      { status: 400 },
    );
  }
  const { email, runId } = parsed.data;

  const run = await db
    .select({ id: runs.id, userId: runs.userId })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);
  if (run.length === 0) {
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }
  if (run[0].userId !== null) {
    return NextResponse.json({ error: "run_not_anonymous" }, { status: 403 });
  }

  // Pull every succeeded generation in the run — we email all three
  // watermark-free versions per the new free-tier funnel rule.
  const rows = await db
    .select({
      id: generations.id,
      presetId: generations.presetId,
      rawUrl: generations.rawUrl,
      outputUrl: generations.outputUrl,
      sourceId: generations.sceneifySourceId,
      status: generations.status,
    })
    .from(generations)
    .where(and(eq(generations.runId, runId), isNull(generations.userId)));

  const succeeded = rows.filter((r) => r.status === "succeeded");
  const photos = succeeded
    .map((r) => ({
      presetId: r.presetId,
      url: r.rawUrl ?? r.outputUrl, // raw_url preferred, output_url is watermarked fallback
    }))
    .filter((p): p is { presetId: string; url: string } => !!p.url);

  if (photos.length === 0) {
    return NextResponse.json({ error: "no_photos_available" }, { status: 409 });
  }

  const pickedScenes = Array.from(
    new Set(rows.map((r) => r.presetId).filter((p): p is string => !!p)),
  );
  const sourceUrl =
    rows.find((r) => r.sourceId)?.sourceId ?? photos[0].url;

  await db.insert(tryIntents).values({
    email: email.toLowerCase(),
    sourceUrl,
    sourceName: "user-upload",
    sourceMimeType: "image/png",
    pickedScenes,
  });

  const siteUrl = env.SITE_URL.replace(/\/$/, "");
  const sendResult = await sendPhotosEmail({
    to: email,
    photos,
    batchUrl: `${siteUrl}/try`,
  });

  if (!sendResult.ok && sendResult.reason === "no_api_key") {
    return NextResponse.json(
      {
        ok: true,
        emailed: false,
        photos,
        warning: "email_provider_not_configured",
      },
      { status: 200 },
    );
  }
  if (!sendResult.ok) {
    return NextResponse.json(
      {
        ok: true,
        emailed: false,
        photos,
        warning: "email_send_failed",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, emailed: true, photos });
}
