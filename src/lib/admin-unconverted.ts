import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type UnconvertedRunRow = {
  runId: string;
  runName: string | null;
  createdAt: string;
  totalGenerations: number;
  succeeded: number;
  failed: number;
  presetIds: string[];
  sourceCount: number;
  sourcePreviewUrl: string | null;
  unlockAttempted: boolean;
  unlockCustomerEmail: string | null;
  unlockPaidAt: string | null;
};

export async function listUnconvertedRuns(): Promise<UnconvertedRunRow[]> {
  const { data: runs, error: runsErr } = await supabaseAdmin
    .from("runs")
    .select("id, name, created_at")
    .is("user_id", null)
    .order("created_at", { ascending: false });
  if (runsErr) throw runsErr;
  if (!runs || runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);

  const { data: gens, error: gensErr } = await supabaseAdmin
    .from("generations")
    .select("run_id, status, preset_id, sceneify_source_id, output_url, raw_url, created_at")
    .in("run_id", runIds);
  if (gensErr) throw gensErr;

  const { data: unlocks, error: unlocksErr } = await supabaseAdmin
    .from("unlock_batches")
    .select("run_id, customer_email, paid_at, status, created_at")
    .in("run_id", runIds);
  if (unlocksErr) throw unlocksErr;

  const byRun = new Map<
    string,
    {
      total: number;
      ok: number;
      fail: number;
      presets: Set<string>;
      sources: Set<string>;
      firstOutput: string | null;
    }
  >();
  for (const g of gens ?? []) {
    if (!g.run_id) continue;
    const cur =
      byRun.get(g.run_id) ?? {
        total: 0,
        ok: 0,
        fail: 0,
        presets: new Set<string>(),
        sources: new Set<string>(),
        firstOutput: null,
      };
    cur.total += 1;
    if (g.status === "succeeded") cur.ok += 1;
    if (g.status === "failed") cur.fail += 1;
    if (g.preset_id) cur.presets.add(g.preset_id);
    if (g.sceneify_source_id) cur.sources.add(g.sceneify_source_id);
    if (!cur.firstOutput) cur.firstOutput = g.output_url ?? g.raw_url ?? null;
    byRun.set(g.run_id, cur);
  }

  const unlocksByRun = new Map<
    string,
    { customerEmail: string | null; paidAt: string | null }
  >();
  for (const u of unlocks ?? []) {
    if (!u.run_id) continue;
    const existing = unlocksByRun.get(u.run_id);
    if (
      !existing ||
      (u.paid_at && !existing.paidAt) ||
      (u.customer_email && !existing.customerEmail)
    ) {
      unlocksByRun.set(u.run_id, {
        customerEmail: u.customer_email ?? existing?.customerEmail ?? null,
        paidAt: u.paid_at ?? existing?.paidAt ?? null,
      });
    }
  }

  return runs.map((r) => {
    const s = byRun.get(r.id);
    const u = unlocksByRun.get(r.id);
    return {
      runId: r.id,
      runName: r.name,
      createdAt: r.created_at,
      totalGenerations: s?.total ?? 0,
      succeeded: s?.ok ?? 0,
      failed: s?.fail ?? 0,
      presetIds: s ? Array.from(s.presets) : [],
      sourceCount: s ? s.sources.size : 0,
      sourcePreviewUrl: s?.firstOutput ?? null,
      unlockAttempted: !!u,
      unlockCustomerEmail: u?.customerEmail ?? null,
      unlockPaidAt: u?.paidAt ?? null,
    };
  });
}

export type UnconvertedGenerationDetail = {
  id: string;
  presetId: string | null;
  status: string;
  quality: string;
  watermarked: boolean;
  packRole: string | null;
  outputUrl: string | null;
  rawUrl: string | null;
  sourceUrl: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type UnconvertedRunDetail = {
  runId: string;
  runName: string | null;
  createdAt: string;
  sources: string[];
  generations: UnconvertedGenerationDetail[];
  unlock: {
    token: string;
    status: string;
    customerEmail: string | null;
    paidAt: string | null;
    createdAt: string;
    stripeSessionId: string | null;
  } | null;
  totals: {
    generations: number;
    succeeded: number;
    failed: number;
  };
};

export async function getUnconvertedRunDetail(
  runId: string,
): Promise<UnconvertedRunDetail | null> {
  const { data: run, error: runErr } = await supabaseAdmin
    .from("runs")
    .select("id, name, created_at, user_id")
    .eq("id", runId)
    .maybeSingle();
  if (runErr) throw runErr;
  if (!run) return null;
  if (run.user_id !== null) return null;

  const { data: gens, error: gensErr } = await supabaseAdmin
    .from("generations")
    .select(
      "id, preset_id, status, quality, watermarked, pack_role, sceneify_source_id, output_url, raw_url, error, created_at, completed_at",
    )
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (gensErr) throw gensErr;

  const { data: unlock } = await supabaseAdmin
    .from("unlock_batches")
    .select(
      "token, status, customer_email, paid_at, created_at, stripe_session_id",
    )
    .eq("run_id", runId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sources = new Set<string>();
  let succeeded = 0;
  let failed = 0;
  const generations: UnconvertedGenerationDetail[] = (gens ?? []).map((g) => {
    if (g.status === "succeeded") succeeded += 1;
    if (g.status === "failed") failed += 1;
    if (g.sceneify_source_id) sources.add(g.sceneify_source_id);
    return {
      id: g.id,
      presetId: g.preset_id,
      status: g.status,
      quality: g.quality,
      watermarked: g.watermarked,
      packRole: g.pack_role,
      outputUrl: g.output_url,
      rawUrl: g.raw_url,
      sourceUrl: g.sceneify_source_id,
      error: g.error,
      createdAt: g.created_at,
      completedAt: g.completed_at,
    };
  });

  return {
    runId: run.id,
    runName: run.name,
    createdAt: run.created_at,
    sources: Array.from(sources),
    generations,
    unlock: unlock
      ? {
          token: unlock.token,
          status: unlock.status,
          customerEmail: unlock.customer_email,
          paidAt: unlock.paid_at,
          createdAt: unlock.created_at,
          stripeSessionId: unlock.stripe_session_id,
        }
      : null,
    totals: {
      generations: generations.length,
      succeeded,
      failed,
    },
  };
}
