import "server-only";
import { sceneify } from "@/lib/sceneify/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateGeneration } from "@/lib/db/generations";
import { applyWatermark } from "@/lib/watermark";
import { storeWatermarked } from "@/lib/storage";
import { env } from "@/lib/env";

type SourceUpload = {
  blobUrl: string;
  filename: string;
  mimeType: string;
  placeholderKey: string;
};

async function uploadOneSource(upload: SourceUpload, runId: string): Promise<{ placeholderKey: string; sceneifySourceId: string }> {
  "use step";
  const res = await fetch(upload.blobUrl);
  const blob = await res.blob();
  const source = await sceneify().uploadSource(blob, upload.filename);
  await supabaseAdmin
    .from("generations")
    .update({ sceneify_source_id: source.id })
    .eq("run_id", runId)
    .eq("sceneify_source_id", upload.placeholderKey);
  return { placeholderKey: upload.placeholderKey, sceneifySourceId: source.id };
}

async function listPendingForRun(runId: string): Promise<Array<{ id: string; sceneify_source_id: string; preset_id: string }>> {
  "use step";
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, sceneify_source_id, preset_id")
    .eq("run_id", runId)
    .eq("status", "pending");
  if (error) throw error;
  return data ?? [];
}

async function generateOne(row: { id: string; sceneify_source_id: string; preset_id: string }): Promise<void> {
  "use step";
  await updateGeneration(row.id, { status: "running" });
  try {
    const gen = await sceneify().createGeneration({
      sourceId: row.sceneify_source_id,
      presetId: row.preset_id,
      model: "gpt-image-2",
    });
    await updateGeneration(row.id, {
      status: gen.status === "running" || gen.status === "pending" ? "running" : gen.status,
      sceneifyGenerationId: gen.id,
      outputUrl: gen.outputUrl,
      error: gen.error,
      completedAt: gen.completedAt ?? new Date().toISOString(),
    });
  } catch (e) {
    await updateGeneration(row.id, {
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
      completedAt: new Date().toISOString(),
    });
  }
}

async function shouldWatermarkForUser(userId: string): Promise<boolean> {
  "use step";
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();
  const plan = (data?.plan as "free" | "pro") ?? "free";
  return (plan === "free" && env.PLAN_FREE_WATERMARK) ||
         (plan === "pro" && env.PLAN_PRO_WATERMARK);
}

async function listSucceededUnwatermarked(runId: string): Promise<Array<{ id: string; output_url: string | null }>> {
  "use step";
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, output_url")
    .eq("run_id", runId)
    .eq("status", "succeeded")
    .eq("watermarked", false);
  if (error) throw error;
  return data ?? [];
}

async function watermarkOne(row: { id: string; output_url: string | null }, origin: string): Promise<void> {
  "use step";
  if (!row.output_url) return;
  const res = await fetch(row.output_url);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = await applyWatermark(buf, "DARKROOM PREVIEW");
  const url = await storeWatermarked(out, `${row.id}.png`, origin);
  await updateGeneration(row.id, { outputUrl: url, watermarked: true });
}

async function incrementUsage(userId: string, runId: string): Promise<void> {
  "use step";
  const { count } = await supabaseAdmin
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("status", "succeeded");
  const ym = new Date().toISOString().slice(0, 7);
  if (count && count > 0) {
    const { error } = await supabaseAdmin.rpc("increment_usage", {
      p_user_id: userId,
      p_year_month: ym,
      p_delta: count,
    });
    if (error) throw error;
  }
}

export async function processRun(
  runId: string,
  userId: string,
  sourceUploads: SourceUpload[],
  origin: string,
): Promise<void> {
  "use workflow";

  await Promise.all(sourceUploads.map((u) => uploadOneSource(u, runId)));

  const pending = await listPendingForRun(runId);

  await Promise.all(pending.map((row) => generateOne(row)));

  if (await shouldWatermarkForUser(userId)) {
    const succeeded = await listSucceededUnwatermarked(runId);
    await Promise.all(succeeded.map((row) => watermarkOne(row, origin)));
  }

  await incrementUsage(userId, runId);
}
