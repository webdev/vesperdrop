import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateGeneration } from "@/lib/db/generations";
import { applyWatermark } from "@/lib/watermark";
import { storeWatermarked } from "@/lib/storage";
import { type GenerationScene } from "@/lib/ai/generate";
import { generateViaSceneify } from "@/lib/ai/sceneify";
import { env } from "@/lib/env";

type SourceUpload = {
  blobUrl: string;
  filename: string;
  mimeType: string;
  placeholderKey: string;
};

async function listPendingForRun(runId: string): Promise<
  Array<{ id: string; sceneify_source_id: string; preset_id: string }>
> {
  "use step";
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, sceneify_source_id, preset_id")
    .eq("run_id", runId)
    .eq("status", "pending");
  if (error) throw error;
  return data ?? [];
}

async function getSceneBySlug(slug: string): Promise<GenerationScene | null> {
  "use step";
  const { data, error } = await supabaseAdmin
    .from("scenes")
    .select("slug, name, mood, category, image_url")
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return {
    slug: data.slug,
    name: data.name,
    mood: data.mood,
    category: data.category,
    imageUrl: data.image_url,
  };
}

async function mapUploadToUrl(
  placeholderKey: string,
  uploads: SourceUpload[],
): Promise<string> {
  const upload = uploads.find((u) => u.placeholderKey === placeholderKey);
  if (!upload) throw new Error(`Upload not found for key: ${placeholderKey}`);
  return upload.blobUrl;
}

async function generateOne(
  row: { id: string; sceneify_source_id: string; preset_id: string },
  sourceUploads: SourceUpload[],
): Promise<void> {
  "use step";
  await updateGeneration(row.id, { status: "running" });
  try {
    const scene = await getSceneBySlug(row.preset_id);
    if (!scene) throw new Error(`Scene not found: ${row.preset_id}`);

    const sourceImageUrl = await mapUploadToUrl(row.sceneify_source_id, sourceUploads);

    const result = await generateViaSceneify({
      sourceUrl: sourceImageUrl,
      presetSlug: scene.slug,
      model: "nano-banana-2",
      quality: "high",
      callerRef: row.id,
    });

    await updateGeneration(row.id, {
      status: "succeeded",
      outputUrl: result.outputUrl,
      modelUsed: result.model,
      sceneifyGenerationId: result.generationId,
      completedAt: new Date().toISOString(),
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
  const plan = (data?.plan as string) ?? "free";
  return (plan === "free" && env.PLAN_FREE_WATERMARK) ||
         (plan === "pro" && env.PLAN_PRO_WATERMARK);
}

async function listSucceededUnwatermarked(runId: string): Promise<
  Array<{ id: string; output_url: string | null }>
> {
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
  const out = await applyWatermark(buf, "VERCELDROP PREVIEW");
  const url = await storeWatermarked(out, `${row.id}.png`, origin);
  await updateGeneration(row.id, { outputUrl: url, watermarked: true });
}

async function refundFailedCredits(userId: string, runId: string): Promise<void> {
  "use step";
  const { data, error: selectErr } = await supabaseAdmin
    .from("generations")
    .select("id")
    .eq("run_id", runId)
    .eq("status", "failed");
  if (selectErr) throw selectErr;
  const count = data?.length ?? 0;
  if (count > 0) {
    // Refill by adding back failed credits (use the rpc but pass minimal params)
    const { error } = await supabaseAdmin.rpc("refill_credits", {
      p_user_id: userId,
      p_plan: "free", // dummy value, not used in the refund context
      p_credits: count,
      p_renews_at: null,
    });
    if (error) {
      // Log but don't throw — failed refund shouldn't block workflow completion
      console.error("refund failed:", error);
    }
  }
}

export async function processRun(
  runId: string,
  userId: string,
  sourceUploads: SourceUpload[],
  origin: string,
): Promise<void> {
  "use workflow";

  const pending = await listPendingForRun(runId);

  await Promise.all(pending.map((row) => generateOne(row, sourceUploads)));

  if (await shouldWatermarkForUser(userId)) {
    const succeeded = await listSucceededUnwatermarked(runId);
    await Promise.all(succeeded.map((row) => watermarkOne(row, origin)));
  }

  await refundFailedCredits(userId, runId);
}
