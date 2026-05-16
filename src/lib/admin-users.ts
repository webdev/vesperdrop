import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type UserRow = {
  id: string;
  email: string;
  plan: string;
  planBillingInterval: string;
  quotaBalance: number;
  stripeCustomerId: string | null;
  createdAt: string;
  totalGenerations: number;
  succeeded: number;
  failed: number;
  lastGenAt: string | null;
};

export async function listUsersWithStats(): Promise<UserRow[]> {
  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, email, plan, plan_billing_interval, quota_units_balance, stripe_customer_id, created_at",
    );
  if (profilesErr) throw profilesErr;

  const { data: gens, error: gensErr } = await supabaseAdmin
    .from("generations")
    .select("user_id, status, created_at")
    .not("user_id", "is", null);
  if (gensErr) throw gensErr;

  const byUser = new Map<
    string,
    { total: number; ok: number; fail: number; last: string | null }
  >();
  for (const g of gens ?? []) {
    if (!g.user_id) continue;
    const cur = byUser.get(g.user_id) ?? { total: 0, ok: 0, fail: 0, last: null };
    cur.total += 1;
    if (g.status === "succeeded") cur.ok += 1;
    if (g.status === "failed") cur.fail += 1;
    if (!cur.last || g.created_at > cur.last) cur.last = g.created_at;
    byUser.set(g.user_id, cur);
  }

  return (profiles ?? [])
    .map((p) => {
      const s = byUser.get(p.id) ?? { total: 0, ok: 0, fail: 0, last: null };
      return {
        id: p.id,
        email: p.email,
        plan: p.plan,
        planBillingInterval: p.plan_billing_interval,
        quotaBalance: p.quota_units_balance,
        stripeCustomerId: p.stripe_customer_id,
        createdAt: p.created_at,
        totalGenerations: s.total,
        succeeded: s.ok,
        failed: s.fail,
        lastGenAt: s.last,
      };
    })
    .sort((a, b) => b.totalGenerations - a.totalGenerations);
}

export type GenerationDetail = {
  id: string;
  presetId: string | null;
  status: string;
  quality: string;
  watermarked: boolean;
  packRole: string | null;
  modelUsed: string | null;
  sourceUrl: string | null;
  outputUrl: string | null;
  rawUrl: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type RunBucket = {
  runId: string | null;
  runName: string | null;
  runCreatedAt: string | null;
  sources: string[];
  generations: GenerationDetail[];
};

export type UserDetail = {
  profile: {
    id: string;
    email: string;
    plan: string;
    planBillingInterval: string;
    planRenewsAt: string | null;
    quotaBalance: number;
    stripeCustomerId: string | null;
    createdAt: string;
    lastFailedRunAt: string | null;
  };
  auth: {
    signedUpAt: string | null;
    lastSignInAt: string | null;
    emailConfirmedAt: string | null;
    provider: string | null;
  } | null;
  runs: RunBucket[];
  totals: {
    runs: number;
    generations: number;
    succeeded: number;
    failed: number;
  };
};

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, email, plan, plan_billing_interval, plan_renews_at, quota_units_balance, stripe_customer_id, created_at, last_failed_run_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) throw profileErr;
  if (!profile) return null;

  const { data: authRow } = await supabaseAdmin
    .schema("auth")
    .from("users")
    .select(
      "created_at, last_sign_in_at, email_confirmed_at, raw_app_meta_data",
    )
    .eq("id", userId)
    .maybeSingle();

  const { data: runs, error: runsErr } = await supabaseAdmin
    .from("runs")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (runsErr) throw runsErr;

  const { data: gens, error: gensErr } = await supabaseAdmin
    .from("generations")
    .select(
      "id, run_id, preset_id, status, quality, watermarked, pack_role, model_used, sceneify_source_id, output_url, raw_url, error, created_at, completed_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (gensErr) throw gensErr;

  const buckets = new Map<string, RunBucket>();
  const ORPHAN_KEY = "__orphan__";
  for (const r of runs ?? []) {
    buckets.set(r.id, {
      runId: r.id,
      runName: r.name,
      runCreatedAt: r.created_at,
      sources: [],
      generations: [],
    });
  }

  let succeeded = 0;
  let failed = 0;
  for (const g of gens ?? []) {
    if (g.status === "succeeded") succeeded += 1;
    if (g.status === "failed") failed += 1;
    const key = g.run_id ?? ORPHAN_KEY;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        runId: g.run_id ?? null,
        runName: null,
        runCreatedAt: g.created_at,
        sources: [],
        generations: [],
      };
      buckets.set(key, bucket);
    }
    if (g.sceneify_source_id && !bucket.sources.includes(g.sceneify_source_id)) {
      bucket.sources.push(g.sceneify_source_id);
    }
    bucket.generations.push({
      id: g.id,
      presetId: g.preset_id,
      status: g.status,
      quality: g.quality,
      watermarked: g.watermarked,
      packRole: g.pack_role,
      modelUsed: g.model_used,
      sourceUrl: g.sceneify_source_id,
      outputUrl: g.output_url,
      rawUrl: g.raw_url,
      error: g.error,
      createdAt: g.created_at,
      completedAt: g.completed_at,
    });
  }

  const bucketList = Array.from(buckets.values())
    .filter((b) => b.generations.length > 0)
    .sort((a, b) => {
      const at = a.runCreatedAt ?? "";
      const bt = b.runCreatedAt ?? "";
      return bt.localeCompare(at);
    });

  const provider =
    (authRow?.raw_app_meta_data as Record<string, unknown> | null)?.provider;

  return {
    profile: {
      id: profile.id,
      email: profile.email,
      plan: profile.plan,
      planBillingInterval: profile.plan_billing_interval,
      planRenewsAt: profile.plan_renews_at,
      quotaBalance: profile.quota_units_balance,
      stripeCustomerId: profile.stripe_customer_id,
      createdAt: profile.created_at,
      lastFailedRunAt: profile.last_failed_run_at,
    },
    auth: authRow
      ? {
          signedUpAt: authRow.created_at,
          lastSignInAt: authRow.last_sign_in_at,
          emailConfirmedAt: authRow.email_confirmed_at,
          provider: typeof provider === "string" ? provider : null,
        }
      : null,
    runs: bucketList,
    totals: {
      runs: bucketList.filter((b) => b.runId).length,
      generations: gens?.length ?? 0,
      succeeded,
      failed,
    },
  };
}
