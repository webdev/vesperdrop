import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function createRun(params: {
  userId: string;
  sourceCount: number;
  presetCount: number;
}) {
  const totalImages = params.sourceCount * params.presetCount;
  const { data, error } = await supabaseAdmin
    .from("runs")
    .insert({
      user_id: params.userId,
      source_count: params.sourceCount,
      preset_count: params.presetCount,
      total_images: totalImages,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, totalImages };
}

export async function getRunForUser(runId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}
