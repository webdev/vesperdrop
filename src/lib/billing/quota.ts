import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tryConsumeQuota as dbTryConsumeQuota } from "@/lib/db/quota";
import { isPaidPlanSlug } from "@/lib/plans";

export type ConsumeQuotaResult =
  | { ok: true; withinCap: boolean }
  | { ok: false; reason: "free_exhausted" };

const FAILED_RETRY_WINDOW_MS = 5 * 60 * 1000;

export async function consumeQuota(
  userId: string,
  _runId: string,
): Promise<ConsumeQuotaResult> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("plan, last_failed_run_at")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new Error(`consumeQuota: profile not found for ${userId}`);
  }

  if (profile.last_failed_run_at) {
    const elapsed = Date.now() - new Date(profile.last_failed_run_at).getTime();
    if (elapsed < FAILED_RETRY_WINDOW_MS) {
      await supabaseAdmin
        .from("profiles")
        .update({ last_failed_run_at: null })
        .eq("id", userId);
      return { ok: true, withinCap: true };
    }
  }

  const deducted = await dbTryConsumeQuota(userId, 1);
  if (deducted) return { ok: true, withinCap: true };

  if (!isPaidPlanSlug(profile.plan)) {
    return { ok: false, reason: "free_exhausted" };
  }
  return { ok: true, withinCap: false };
}

export async function markRunFailed(userId: string): Promise<void> {
  await supabaseAdmin
    .from("profiles")
    .update({ last_failed_run_at: new Date().toISOString() })
    .eq("id", userId);
}
