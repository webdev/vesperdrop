import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { refillQuota } from "@/lib/db/quota";
import { PLAN_QUOTA, type PlanSlug } from "@/lib/plans";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily cron: grant a monthly slice of quota to annual subscribers whose
 * last grant was more than 28 days ago (or who have never been granted
 * since signing up annual). Vercel Cron sends `Authorization: Bearer
 * <CRON_SECRET>`. Anything else returns 401.
 */
export async function GET(req: Request) {
  if (!env.CRON_SECRET) {
    console.error("[cron-annual-grant] CRON_SECRET not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Atomic claim: a single UPDATE flips annual_last_granted_at to now() and
  // returns the rows that were claimed. Two concurrent invocations cannot
  // both see the same row as eligible — Postgres serializes the writes and
  // the second one's predicate (`< cutoff`) no longer matches. We then
  // refill quota only for what we claimed.
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const { data: claimed, error } = await supabaseAdmin
    .from("profiles")
    .update({ annual_last_granted_at: now })
    .eq("plan_billing_interval", "annual")
    .or(`annual_last_granted_at.is.null,annual_last_granted_at.lt.${cutoff}`)
    .select("id, plan, plan_renews_at");

  if (error) {
    console.error("[cron-annual-grant] claim query failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let granted = 0;
  let skipped = 0;
  for (const row of claimed ?? []) {
    const slug = row.plan as PlanSlug;
    const quota = PLAN_QUOTA[slug]?.monthlyQuota ?? 0;
    if (quota <= 0) {
      skipped += 1;
      continue;
    }
    const renewsAt =
      (row.plan_renews_at as string | null) ??
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await refillQuota(row.id as string, slug, quota, renewsAt);
      granted += 1;
    } catch (err) {
      // A claimed-but-unrefilled row is the worst case here: the user is
      // marked granted but their balance wasn't bumped. Manual reconcile
      // can fix it; we log loudly so it doesn't get missed.
      console.error("[cron-annual-grant] refill failed after claim", {
        userId: row.id,
        err,
      });
    }
  }

  console.log("[cron-annual-grant] done", { granted, skipped });
  return NextResponse.json({ granted, skipped });
}
