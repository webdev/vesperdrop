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
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const { data: subs, error } = await supabaseAdmin
    .from("profiles")
    .select("id, plan, annual_last_granted_at, plan_renews_at")
    .eq("plan_billing_interval", "annual")
    .or(`annual_last_granted_at.is.null,annual_last_granted_at.lt.${cutoff}`);

  if (error) {
    console.error("[cron-annual-grant] query failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let granted = 0;
  let skipped = 0;
  for (const row of subs ?? []) {
    const slug = row.plan as PlanSlug;
    const quota = PLAN_QUOTA[slug]?.monthlyQuota ?? 0;
    if (quota <= 0) {
      skipped += 1;
      continue;
    }
    const renewsAt =
      (row.plan_renews_at as string | null) ??
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await refillQuota(row.id as string, slug, quota, renewsAt);
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ annual_last_granted_at: new Date().toISOString() })
      .eq("id", row.id);
    if (upErr) {
      console.error("[cron-annual-grant] failed to update timestamp", {
        userId: row.id,
        error: upErr,
      });
      continue;
    }
    granted += 1;
  }

  console.log("[cron-annual-grant] done", { granted, skipped });
  return NextResponse.json({ granted, skipped });
}
