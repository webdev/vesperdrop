import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRunForUser } from "@/lib/db/runs";
import { listGenerationsForRun } from "@/lib/db/generations";
import { listPacksForRun } from "@/lib/db/packs";
import { db } from "@/lib/db";
import { scenes as scenesTable } from "@/lib/db/schema";
import { RunGrid, type Generation, type Pack } from "./run-grid";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/app/runs/${id}`);

  let run;
  try {
    run = await getRunForUser(id, user.id);
  } catch {
    notFound();
  }

  const rows = await listGenerationsForRun(id, user.id);
  const packs = await listPacksForRun(id, user.id);
  const sceneRows = await db
    .select({ slug: scenesTable.slug, name: scenesTable.name })
    .from(scenesTable);

  const initial: Generation[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    outputUrl: r.outputUrl,
    presetId: r.presetId,
    error: r.error,
    watermarked: r.watermarked,
    quality: r.quality,
    sceneifySourceId: r.sceneifySourceId,
    sceneifyGenerationId: r.sceneifyGenerationId,
    parentGenerationId: r.parentGenerationId,
    packId: r.packId,
    packRole: r.packRole,
    packShotIndex: r.packShotIndex,
  }));
  const initialPacks: Pack[] = packs.map((p) => ({
    id: p.id,
    parentGenerationId: p.parentGenerationId,
    platform: p.platform,
    shotCount: p.shotCount,
    status: p.status,
  }));

  return (
    <RunGrid
      runId={id}
      run={{
        id: run.id,
        createdAt: run.createdAt.toISOString(),
        totalImages: run.totalImages,
        presetCount: run.presetCount,
      }}
      scenes={sceneRows.map((s) => ({ slug: s.slug, name: s.name }))}
      initial={initial}
      initialPacks={initialPacks}
    />
  );
}
