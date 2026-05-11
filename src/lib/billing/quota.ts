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
): Promise<ConsumeQuotaResult> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("plan, last_failed_run_at")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new Error(`consumeQuota: profile not found for ${userId}`);
  }

  // Retry-within-5-minutes grace. Atomic: predicate the clear on the timestamp
  // we read, so two concurrent retries can't both skip deduction — only the
  // first UPDATE matches and claims the grace.
  if (profile.last_failed_run_at) {
    const ts = profile.last_failed_run_at as string;
    const elapsed = Date.now() - new Date(ts).getTime();
    if (elapsed < FAILED_RETRY_WINDOW_MS) {
      const { data: cleared } = await supabaseAdmin
        .from("profiles")
        .update({ last_failed_run_at: null })
        .eq("id", userId)
        .eq("last_failed_run_at", ts)
        .select("id");
      if (cleared && cleared.length > 0) {
        return { ok: true, withinCap: true };
      }
      // Lost the race; fall through to normal deduction.
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
