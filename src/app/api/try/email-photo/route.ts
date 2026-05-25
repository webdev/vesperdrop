import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { tryIntents, generations, runs, unlockBatches } from "@/lib/db/schema";
import { sendPhotosEmail } from "@/lib/email/send-photo";
import { stashPendingEmail, flushPendingBatchEmail } from "@/lib/email/deferred-send";
import { env } from "@/lib/env";

// /try email capture — works in TWO states (VES-46):
//
//   1. POST-COMPLETION (legacy): generation is done, the run + succeeded
//      generations exist. We send ALL watermark-free HD versions
//      immediately via Resend and return `state:"sent"`.
//
//   2. MID-GENERATION (new): the visitor drops their email WHILE tiles
//      are still rendering. The run may not be finalized yet, so we
//      stash `pending_email` on the unlock_batches row keyed by the
//      client-minted token and return `state:"queued"`. The deferred
//      send fires server-side once /api/try/finalize-batch commits —
//      so it works even if the tab is closed (this is the whole point).
//
// In BOTH states the request is a server-confirmed conversion: a
// try_intents row is written and the response is `Lead`-eligible. The
// client fires `fbq('track','Lead')` on `ok:true`. The frontend (VES-45)
// keys its UI off `state` to distinguish "your photos are sent" from
// "we'll email them when they're ready".
//
// The locked free-tier rule (CLAUDE.md §15a, 2026-05-18) delivers all 3
// watermark-free outputs as the email reward. No account creation, no OTP.

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

// Either runId (post-completion) or token (mid-generation, the client-
// minted 32-hex /try/b/<token> key) identifies the batch. At least one
// is required. token is the durable key — it exists the instant
// generation starts, before finalize-batch writes the run.
const TOKEN_REGEX = /^[0-9a-f]{32}$/i;
const BodySchema = z
  .object({
    email: z.string().email().max(254),
    runId: z.string().uuid().optional(),
    token: z.string().regex(TOKEN_REGEX).optional(),
    // Scenes the visitor previewed — recorded on try_intents for the
    // ads conversion record when we don't yet have generation rows to
    // derive them from (mid-generation case).
    pickedScenes: z.array(z.string().max(100)).max(6).optional(),
    // Source URL of the uploaded product photo, for the try_intents row
    // in the mid-generation case (no generation rows to read it from).
    sourceUrl: z.string().url().optional(),
  })
  .refine((b) => !!b.runId || !!b.token, {
    message: "either runId or token is required",
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
  const { email, runId, token, pickedScenes, sourceUrl } = parsed.data;

  // Resolve the run. We prefer runId (post-completion path). When only a
  // token is supplied (mid-generation), look up the linked runId — it
  // may be null until finalize-batch lands.
  let resolvedRunId: string | null = runId ?? null;
  if (!resolvedRunId && token) {
    const [batch] = await db
      .select({ runId: unlockBatches.runId })
      .from(unlockBatches)
      .where(eq(unlockBatches.token, token))
      .limit(1);
    resolvedRunId = batch?.runId ?? null;
  }

  // If we have a run, confirm it's anonymous and pull succeeded photos.
  let photos: { presetId: string; url: string }[] = [];
  let derivedScenes: string[] = [];
  let derivedSource: string | null = null;
  if (resolvedRunId) {
    const run = await db
      .select({ id: runs.id, userId: runs.userId })
      .from(runs)
      .where(eq(runs.id, resolvedRunId))
      .limit(1);
    if (run.length === 0 && runId) {
      // Explicit runId that doesn't exist is a client error.
      return NextResponse.json({ error: "run_not_found" }, { status: 404 });
    }
    if (run.length > 0 && run[0].userId !== null) {
      return NextResponse.json({ error: "run_not_anonymous" }, { status: 403 });
    }
    if (run.length > 0) {
      const rows = await db
        .select({
          presetId: generations.presetId,
          rawUrl: generations.rawUrl,
          outputUrl: generations.outputUrl,
          sourceId: generations.sceneifySourceId,
          status: generations.status,
        })
        .from(generations)
        .where(and(eq(generations.runId, resolvedRunId), isNull(generations.userId)));

      photos = rows
        .filter((r) => r.status === "succeeded")
        .map((r) => ({ presetId: r.presetId, url: r.rawUrl ?? r.outputUrl }))
        .filter((p): p is { presetId: string; url: string } => !!p.url);

      derivedScenes = Array.from(
        new Set(rows.map((r) => r.presetId).filter((p): p is string => !!p)),
      );
      derivedSource = rows.find((r) => r.sourceId)?.sourceId ?? null;
    }
  }

  // ── State 1: photos ready → send (watermark-free HD) ──────────────
  if (photos.length > 0) {
    const intentScenes = pickedScenes ?? derivedScenes;
    const intentSource = sourceUrl ?? derivedSource ?? photos[0].url;

    // When a token is present, route the send through the latched
    // deferred-send path so duplicate submits / retries on an already-
    // finalized batch can't double-email (idempotency is enforced by
    // unlock_batches.email_sent_at). stashPendingEmail also writes the
    // try_intents conversion record. The pure-runId path (no token,
    // legacy post-completion callers) keeps the direct send below.
    if (token) {
      await stashPendingEmail({
        token,
        email,
        sourceUrl: intentSource,
        pickedScenes: intentScenes,
      });
      const flush = await flushPendingBatchEmail(token);
      if (flush.status === "sent") {
        return NextResponse.json({ ok: true, state: "sent", emailed: true, photos });
      }
      if (flush.status === "already_sent") {
        // A prior submit already delivered — report success without a
        // second email. Still Lead-eligible (server-confirmed intent).
        return NextResponse.json({ ok: true, state: "sent", emailed: true, photos });
      }
      if (flush.status === "provider_not_configured") {
        return NextResponse.json(
          { ok: true, state: "sent", emailed: false, photos, warning: "email_provider_not_configured" },
          { status: 200 },
        );
      }
      // send_failed / no_photos (race) — surface as a soft warning; the
      // intent is persisted so the Lead still fires.
      return NextResponse.json(
        { ok: true, state: "sent", emailed: false, photos, warning: "email_send_failed" },
        { status: 200 },
      );
    }

    await db.insert(tryIntents).values({
      email: email.toLowerCase(),
      sourceUrl: intentSource,
      sourceName: "user-upload",
      sourceMimeType: "image/png",
      pickedScenes: intentScenes,
    });

    const siteUrl = env.SITE_URL.replace(/\/$/, "");
    const sendResult = await sendPhotosEmail({
      to: email,
      photos,
      batchUrl: `${siteUrl}/try`,
    });

    if (!sendResult.ok && sendResult.reason === "no_api_key") {
      return NextResponse.json(
        { ok: true, state: "sent", emailed: false, photos, warning: "email_provider_not_configured" },
        { status: 200 },
      );
    }
    if (!sendResult.ok) {
      return NextResponse.json(
        { ok: true, state: "sent", emailed: false, photos, warning: "email_send_failed" },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true, state: "sent", emailed: true, photos });
  }

  // ── State 2: mid-generation → stash for deferred send ─────────────
  // No photos yet. We need a token to stash the pending email against
  // (the durable key that survives finalize-batch). Without a token we
  // can't defer — the run exists but has no succeeded tiles AND we have
  // no batch row to attach to.
  if (!token) {
    return NextResponse.json({ error: "no_photos_available" }, { status: 409 });
  }

  await stashPendingEmail({
    token,
    email,
    sourceUrl: sourceUrl ?? derivedSource ?? "user-upload",
    pickedScenes: pickedScenes ?? derivedScenes,
  });

  return NextResponse.json({ ok: true, state: "queued", emailed: false });
}
