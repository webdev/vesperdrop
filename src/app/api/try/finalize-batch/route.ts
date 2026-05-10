import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUnlockBatch } from "@/lib/db/unlock-batches";
import type { UnlockBatchGeneration } from "@/lib/db/schema";

export const runtime = "nodejs";

const generationSchema = z.object({
  sceneSlug: z.string().min(1).max(100),
  sceneName: z.string().min(1).max(200),
  outputUrl: z.string().url(),
  rawUrl: z.string().url().optional(),
  isBonus: z.boolean(),
  isFreePreview: z.boolean(),
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
  const bonusCount = generations.filter((g) => g.isBonus).length;
  if (bonusCount > 1) {
    return NextResponse.json(
      { error: "at most one bonus generation allowed" },
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
  }));

  const token = await createUnlockBatch({
    generations: stored,
    userId: user?.id ?? null,
  });

  return NextResponse.json({ token }, { status: 201 });
}
