import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRunForUser } from "@/lib/db/runs";
import { listGenerationsForRun } from "@/lib/db/generations";
import { listPacksForRun } from "@/lib/db/packs";
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
  const initial: Generation[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    outputUrl: r.outputUrl,
    presetId: r.presetId,
    error: r.error,
    watermarked: r.watermarked,
    quality: r.quality,
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
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Run</h1>
        <p className="text-sm text-zinc-500">{run.totalImages} images</p>
      </header>
      <RunGrid runId={id} initial={initial} initialPacks={initialPacks} />
    </div>
  );
}
