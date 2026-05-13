import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { runs, generations, unlockBatches } from "@/lib/db/schema";
import { newToken } from "@/lib/db/unlock-batches";
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

  // The unauth flow lets visitors pick 1–6 scenes (StudioDevelopFrame
  // adapts its layout per count). Index 0 is always the free preview;
  // any other index marked as free preview is rejected.
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
  const { runId, token } = await db.transaction(async (tx) => {
    const [runRow] = await tx
      .insert(runs)
      .values({
        userId,
        sourceCount: 1,
        presetCount: gens.length,
        totalImages: gens.length,
      })
      .returning({ id: runs.id });

    await tx.insert(generations).values(
      gens.map((g) => ({
        runId: runRow.id,
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
      })),
    );

    const t = clientToken ?? newToken();
    await tx.insert(unlockBatches).values({
      token: t,
      generations: stored,
      userId,
      runId: runRow.id,
    });
    return { runId: runRow.id, token: t };
  });

  return NextResponse.json({ token, runId }, { status: 201 });
}
