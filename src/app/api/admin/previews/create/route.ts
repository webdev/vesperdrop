import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { createIgPreview } from "@/lib/ig-previews/pages";
import { pickRandomPresets, planGeneration } from "@/lib/ig-previews/presets";
import { sceneify } from "@/lib/sceneify/client";

export const runtime = "nodejs";

const Body = z.object({
  sourceImages: z
    .array(
      z.object({
        url: z.string().url(),
        name: z.string(),
        mimeType: z.string(),
      }),
    )
    .min(1)
    .max(12),
  presetSlugs: z.array(z.string().min(1)).min(1).max(20),
  notes: z.string().max(2000).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid body" },
      { status: 400 },
    );
  }
  const { sourceImages, presetSlugs: chosenSlugs, notes, title } = parsed.data;

  const allPresets = await sceneify().listPublicPresets();
  const allowed = new Set(allPresets.map((p) => p.slug));
  const dedup = Array.from(new Set(chosenSlugs));
  const unknown = dedup.filter((s) => !allowed.has(s));
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `unknown preset: ${unknown.join(", ")}` },
      { status: 400 },
    );
  }

  const plan = planGeneration(sourceImages.length);
  const outputSlugs = pickRandomPresets(dedup, plan.totalCount);

  const preview = await createIgPreview({
    presetSlug: dedup[0],
    sourceImages,
    presetSlugs: outputSlugs,
    expectedOutputCount: plan.totalCount,
    notes: notes ?? null,
    title: title ?? null,
    createdBy: user!.email!,
  });

  const url = `https://www.vesperdrop.com/p/${preview.slug}`;

  return NextResponse.json({
    id: preview.id,
    slug: preview.slug,
    url,
    expectedOutputCount: preview.expectedOutputCount,
    presetSlugs: preview.presetSlugs,
  });
}
