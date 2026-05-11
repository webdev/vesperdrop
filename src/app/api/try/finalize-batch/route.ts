import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUnlockBatch } from "@/lib/db/unlock-batches";
import type { UnlockBatchGeneration } from "@/lib/db/schema";

export const runtime = "nodejs";

// Normalized 0..1 focal coordinates emitted by Sceneify alongside the
// generation. We don't compute or re-derive them server-side; we just
// pass them through to the persisted JSONB so the render layer (and
// any future db-row migration) has them.
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
});

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

  const { generations } = parsed.data;

  if (generations.length !== 3) {
    return NextResponse.json(
      { error: "expected exactly 3 generations" },
      { status: 400 },
    );
  }
  if (!generations[0].isFreePreview) {
    return NextResponse.json(
      { error: "first generation must be the free preview" },
      { status: 400 },
    );
  }
  if (generations.slice(1).some((g) => g.isFreePreview)) {
    return NextResponse.json(
      { error: "only index 0 may be the free preview" },
      { status: 400 },
    );
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stored: UnlockBatchGeneration[] = generations.map((g) => ({
    sceneSlug: g.sceneSlug,
    sceneName: g.sceneName,
    outputUrl: g.outputUrl,
    rawUrl: g.rawUrl ?? null,
    isBonus: g.isBonus,
    isFreePreview: g.isFreePreview,
    focalPoint: g.focalPoint ?? null,
    faceBox: g.faceBox ?? null,
  }));

  const token = await createUnlockBatch({
    generations: stored,
    userId: user?.id ?? null,
  });

  return NextResponse.json({ token }, { status: 201 });
}
