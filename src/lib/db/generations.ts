import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function insertPendingGenerations(rows: Array<{
  runId: string;
  userId: string;
  sceneifySourceId: string;
  presetId: string;
}>) {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .insert(rows.map((r) => ({
      run_id: r.runId,
      user_id: r.userId,
      sceneify_source_id: r.sceneifySourceId,
      preset_id: r.presetId,
    })))
    .select("id, preset_id, sceneify_source_id");
  if (error) throw error;
  return data;
}

export async function updateGeneration(id: string, patch: {
  status?: "running" | "succeeded" | "failed";
  sceneifyGenerationId?: string;
  sceneifySourceId?: string;
  outputUrl?: string;
  watermarked?: boolean;
  error?: string;
  completedAt?: string;
}) {
  const update: Record<string, unknown> = {};
  if (patch.status) update.status = patch.status;
  if (patch.sceneifyGenerationId) update.sceneify_generation_id = patch.sceneifyGenerationId;
  if (patch.sceneifySourceId) update.sceneify_source_id = patch.sceneifySourceId;
  if (patch.outputUrl) update.output_url = patch.outputUrl;
  if (patch.watermarked !== undefined) update.watermarked = patch.watermarked;
  if (patch.error) update.error = patch.error;
  if (patch.completedAt) update.completed_at = patch.completedAt;
  const { error } = await supabaseAdmin.from("generations").update(update).eq("id", id);
  if (error) throw error;
}

export async function listGenerationsForRun(runId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("*")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}
