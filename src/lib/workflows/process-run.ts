import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateGeneration } from "@/lib/db/generations";
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

async function mapUploadToUrl(
  stored: string,
  uploads: SourceUpload[],
): Promise<string> {
  // New runs persist the blob URL directly; return it as-is. Legacy in-flight
  // runs may still carry a placeholderKey (or the try/claim flow's
  // __local__/ key) — fall back to the original lookup.
  if (/^https?:\/\//i.test(stored) || stored.startsWith("__local__/")) {
    return stored;
  }
  const upload = uploads.find((u) => u.placeholderKey === stored);
  if (!upload) throw new Error(`Upload not found for key: ${stored}`);
  return upload.blobUrl;
}

async function generateOne(
  row: { id: string; sceneify_source_id: string; preset_id: string },
  sourceUploads: SourceUpload[],
): Promise<void> {
  "use step";
  await updateGeneration(row.id, { status: "running" });
  try {
    const sourceImageUrl = await mapUploadToUrl(row.sceneify_source_id, sourceUploads);

    // Request gpt-image-2 for top-tier quality. Sceneify's image-gen
    // pipeline auto-falls-back to nano-banana-2 (then the rest of the
    // chain) when gpt-image-2 returns a 422 / content-policy refusal,
    // so we don't need to handle the fallback here. The actual model
    // that rendered is returned in result.model — already persisted
    // via modelUsed below.
    const result = await generateViaSceneify({
      sourceUrl: sourceImageUrl,
      presetSlug: row.preset_id,
      model: "gpt-image-2",
      quality: "high",
      callerRef: row.id,
    });

    await updateGeneration(row.id, {
      status: "succeeded",
      outputUrl: result.outputUrl,
      modelUsed: result.model,
      sceneifyGenerationId: result.generationId,
      completedAt: new Date().toISOString(),
      focalPoint: result.focalPoint ?? null,
      faceBox: result.faceBox ?? null,
    });
  } catch (e) {
    await updateGeneration(row.id, {
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
      completedAt: new Date().toISOString(),
    });
  }
}

async function generateMock(
  row: { id: string; sceneify_source_id: string; preset_id: string },
  sourceUploads: SourceUpload[],
): Promise<void> {
  "use step";
  console.log(`[mock-gen] returning mock generation for ${row.id}; Sceneify skipped`);
  await updateGeneration(row.id, { status: "running" });
  try {
    const sourceImageUrl = await mapUploadToUrl(row.sceneify_source_id, sourceUploads);
    // ~10–15s simulates a real generation duration so the client-derived
    // phase timeline (preparing → generating → enhancing → completed) gets
    // to walk through all states for UX iteration without burning Sceneify.
    await new Promise((resolve) => setTimeout(resolve, 10000 + Math.random() * 5000));
    // Plausible synthetic face box for portrait-style stock photos: roughly
    // upper-center. Lets us iterate on the overlay UI without burning Sceneify.
    await updateGeneration(row.id, {
      status: "succeeded",
      outputUrl: sourceImageUrl,
      modelUsed: "mock",
      sceneifyGenerationId: `mock-${row.id}`,
      completedAt: new Date().toISOString(),
      focalPoint: { x: 0.5, y: 0.22, confidence: 0.9, source: "face" },
      faceBox: { x: 0.38, y: 0.08, width: 0.24, height: 0.28, confidence: 0.9 },
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

/**
 * Just flips the `watermarked` flag on the row — the actual watermarking
 * happens at serve time in /api/images/[id] based on the user's current
 * plan. This way, when someone upgrades, their existing images render
 * cleanly on the next request without any backfill or byte rewrite.
 *
 * Renamed from watermarkOne (which used to bake the watermark into
 * stored bytes — that broke plan upgrades because the bytes themselves
 * stayed watermarked).
 */
async function markWatermarked(row: { id: string }): Promise<void> {
  "use step";
  await updateGeneration(row.id, { watermarked: true });
}

async function refundFailedQuota(userId: string, runId: string): Promise<void> {
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
    const { error } = await supabaseAdmin.rpc("refill_quota", {
      p_user_id: userId,
      p_plan: "free", // dummy value, not used in the refund context
      p_quota: count,
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
  mockMode = false,
): Promise<void> {
  "use workflow";

  const pending = await listPendingForRun(runId);

  if (mockMode) {
    await Promise.all(pending.map((row) => generateMock(row, sourceUploads)));
    return;
  }

  await Promise.all(pending.map((row) => generateOne(row, sourceUploads)));

  if (await shouldWatermarkForUser(userId)) {
    const succeeded = await listSucceededUnwatermarked(runId);
    await Promise.all(succeeded.map((row) => markWatermarked(row)));
  }

  await refundFailedQuota(userId, runId);
}
