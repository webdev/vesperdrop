import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { runs, generations, unlockBatches } from "@/lib/db/schema";
import { newToken } from "@/lib/db/unlock-batches";
import { ensureBatchRun } from "@/lib/db/try-batch";
import { flushPendingBatchEmail } from "@/lib/email/deferred-send";
import type { UnlockBatchGeneration } from "@/lib/db/schema";

export const runtime = "nodejs";

// 32-hex unlock-batch token format (16 bytes → 32 chars). Frontend mints
// a client-side token at the start of generation so the URL can flip to
// /try/b/<token> immediately; finalize-batch uses it as-is. We validate
// it to keep arbitrary strings from landing in the primary key.
const TOKEN_REGEX = /^[0-9a-f]{32}$/i;

// Normalized 0..1 focal coordinates emitted by Sceneify alongside the
// generation. We don't compute or re-derive them server-side; we just
// pass them through to the row + JSONB so the render layer has them.
const focalPointSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    source: z.enum(["face", "saliency", "center"]),
  })
  .nullable()
  .optional();

const faceBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  })
  .nullable()
  .optional();

const generationSchema = z.object({
  sceneSlug: z.string().min(1).max(100),
  sceneName: z.string().min(1).max(200),
  outputUrl: z.string().url(),
  rawUrl: z.string().url().optional(),
  // Retained as optional for back-compat with the bonus-tile model;
  // the funnel no longer auto-injects a bonus generation.
  isBonus: z.boolean().optional().default(false),
  isFreePreview: z.boolean(),
  focalPoint: focalPointSchema,
  faceBox: faceBoxSchema,
});

const bodySchema = z.object({
  generations: z.array(generationSchema).min(1).max(6),
  // Source URL of the product photo the visitor uploaded. Stored on
  // each generation row as `sceneify_source_id` (mirrors the authed
  // /api/try/claim path). Optional only for back-compat with older
  // clients; new clients should always send it.
  sourceUrl: z.string().url().optional(),
  // Optional client-minted token. When supplied the frontend has
  // already replaceState'd the URL to /try/b/<token> at the start of
  // generation; we reuse it so the URL doesn't change again at the
  // end. Omitting it preserves the legacy behavior (server mints).
  token: z.string().regex(TOKEN_REGEX).optional(),
});

/**
 * Finalize a /try batch:
 *   1. Persist a `runs` row (anonymous if no session, owned otherwise)
 *   2. Persist 3 `generations` rows (one per scene, with focal data)
 *   3. Mint an unlock_batches token linked to the run
 *
 * All three writes happen inside a single transaction so a partial
 * failure leaves no orphans. The visitor receives `{ token }` and
 * the frontend flips its URL to /try/b/{token}.
 *
 * On OTP claim, /api/try/attach-batch UPDATEs runs.user_id +
 * generations.user_id in lockstep to re-parent the anonymous rows.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { generations: gens, sourceUrl, token: clientToken } = parsed.data;

  // Index 0 is always the free preview; any other index marked as free
  // preview is rejected.
  if (!gens[0].isFreePreview) {
    return NextResponse.json(
      { error: "first generation must be the free preview" },
      { status: 400 },
    );
  }
  if (gens.slice(1).some((g) => g.isFreePreview)) {
    return NextResponse.json(
      { error: "only index 0 may be the free preview" },
      { status: 400 },
    );
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  // Free-tier cap: unauth visitors are limited to 3 scenes per batch
  // (1 free hero + 2 unlockable for $9.99 / $14.99 bundle). Authed
  // visitors can run the full 6. Belt-and-suspenders for the client
  // cap in try-flow.tsx — a tampered client can't oversubscribe the
  // free tier here.
  const maxScenes = userId ? 6 : 3;
  if (gens.length > maxScenes) {
    return NextResponse.json(
      { error: `at most ${maxScenes} scenes per batch` },
      { status: 400 },
    );
  }

  // The DB row stores the source URL on each generation; fall back
  // to the first output URL if the client didn't pass one (rare —
  // older versions of the frontend) so the column stays non-null.
  const sceneifySource = sourceUrl ?? gens[0].outputUrl;

  const stored: UnlockBatchGeneration[] = gens.map((g) => ({
    sceneSlug: g.sceneSlug,
    sceneName: g.sceneName,
    outputUrl: g.outputUrl,
    rawUrl: g.rawUrl ?? null,
    isBonus: g.isBonus,
    isFreePreview: g.isFreePreview,
    focalPoint: g.focalPoint ?? null,
    faceBox: g.faceBox ?? null,
  }));

  const now = new Date();
  const token = clientToken ?? newToken();

  // Reuse the run the server may have already created for this batch token
  // (VES-53): /api/try/generate persists tiles server-side as they complete
  // and links a run to the token, so a closed tab still has a deliverable
  // batch. If we minted a fresh run here we'd orphan those rows and relink
  // the token to an empty run. ensureBatchRun is the single source of run
  // creation per token — it returns the existing run when one is linked, or
  // creates one (and the unlock_batches stub) otherwise. For the legacy
  // no-token path there is no server persistence, so we mint directly.
  const runId = clientToken
    ? await ensureBatchRun({ token, userId, batchSize: gens.length })
    : null;

  const resolvedRunId = await db.transaction(async (tx) => {
    let rid = runId;
    if (!rid) {
      const [runRow] = await tx
        .insert(runs)
        .values({
          userId,
          sourceCount: 1,
          presetCount: gens.length,
          totalImages: gens.length,
        })
        .returning({ id: runs.id });
      rid = runRow.id;
    }

    // Upsert generations on (run_id, preset_id) — the server tile-complete
    // write may already have inserted these rows, so a plain insert would
    // collide. The client payload is authoritative (it carries the real
    // watermarked/raw URLs + focal data + the user-picked free-preview
    // ordering), so on conflict we overwrite with it.
    for (const g of gens) {
      await tx
        .insert(generations)
        .values({
          runId: rid,
          userId,
          sceneifySourceId: sceneifySource,
          presetId: g.sceneSlug,
          status: "succeeded" as const,
          outputUrl: g.outputUrl,
          rawUrl: g.rawUrl ?? null,
          watermarked: true,
          quality: "preview" as const,
          focalPoint: g.focalPoint ?? null,
          faceBox: g.faceBox ?? null,
          completedAt: now,
        })
        .onConflictDoUpdate({
          target: [generations.runId, generations.presetId],
          set: {
            userId,
            sceneifySourceId: sceneifySource,
            status: "succeeded" as const,
            outputUrl: g.outputUrl,
            rawUrl: g.rawUrl ?? null,
            watermarked: true,
            quality: "preview" as const,
            focalPoint: g.focalPoint ?? null,
            faceBox: g.faceBox ?? null,
            completedAt: now,
          },
        });
    }

    // Upsert (not plain insert): a visitor may have submitted their email
    // mid-generation, in which case /api/try/email-photo (or the server
    // tile-complete path) already created a stub unlock_batches row keyed by
    // this client-minted token. On conflict we fill in the real generations
    // + runId WITHOUT clobbering pending_email / email_sent_at / attempts,
    // so the deferred send below can fire. (VES-46 / VES-53)
    await tx
      .insert(unlockBatches)
      .values({
        token,
        generations: stored,
        userId,
        runId: rid,
      })
      .onConflictDoUpdate({
        target: unlockBatches.token,
        set: { generations: stored, userId, runId: rid },
      });
    return rid;
  });

  // Deferred email-during-generation send (VES-46). If a pending_email
  // was stashed mid-generation, deliver the watermark-free photos now
  // that the run + succeeded generations exist. Idempotent (latched on
  // email_sent_at) and best-effort: a send failure must NOT fail the
  // finalize response — the batch is persisted and the URL has already
  // flipped to /try/b/<token>. Errors are swallowed with a warning; a
  // future flush (e.g. a post-completion email-photo call) can retry.
  try {
    await flushPendingBatchEmail(token);
  } catch (err) {
    console.warn("[finalize-batch] deferred email flush failed", { token, err });
  }

  return NextResponse.json({ token, runId: resolvedRunId }, { status: 201 });
}
