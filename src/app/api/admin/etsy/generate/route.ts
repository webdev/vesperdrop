import { NextResponse } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  getCandidatesByIds,
  setCandidatesStatus,
} from "@/lib/etsy-outreach/candidates";
import {
  createPreviewPage,
  listInflightCandidateIds,
  setPreviewQueued,
} from "@/lib/etsy-outreach/pages";
import { processEtsyPreview } from "@/lib/workflows/process-etsy-preview";

const Body = z.object({
  // Cap is large because the runtime concurrency gate (FAL_GATE +
  // chunkAndRun) limits how many generations actually run in parallel
  // — this cap is just a guard against accidental gigantic payloads.
  candidateIds: z.array(z.string().uuid()).min(1).max(500),
  mock: z.boolean().default(false),
});

const CONCURRENCY = Number(process.env.ETSY_GENERATION_CONCURRENCY ?? 4);

async function chunkAndRun<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const adminEmail = user!.email!;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { candidateIds, mock } = parsed.data;

  const candidates = await getCandidatesByIds(candidateIds);
  if (candidates.length === 0) {
    return NextResponse.json({ error: "no candidates" }, { status: 400 });
  }

  // Skip candidates that already have an in-flight (queued or generating)
  // preview row. Re-clicking Generate on the same selection should not
  // produce duplicate orphan workflows.
  const inflight = await listInflightCandidateIds(candidateIds);
  const fresh = candidates.filter((c) => !inflight.has(c.id));
  const skipped = candidates.length - fresh.length;
  if (fresh.length === 0) {
    return NextResponse.json({
      enqueued: 0,
      skipped,
      mock,
      note: "all candidates already in flight",
    });
  }

  const pages = await Promise.all(
    fresh.map((c) => createPreviewPage({ candidate: c, createdBy: adminEmail })),
  );
  await setCandidatesStatus(
    fresh.map((c) => c.id),
    "generating",
  );

  // Enqueue workflows. start() resolves once the workflow is enqueued in
  // WDK; immediately after, mark the page row 'queued' so the admin
  // table reflects the durable-queue state until the workflow's first
  // step transitions it to 'generating'.
  void chunkAndRun(pages, CONCURRENCY, async (p) => {
    await start(processEtsyPreview, [p.id, mock]);
    await setPreviewQueued(p.id);
  }).catch((e) => console.error("[etsy-outreach] batch failed", e));

  return NextResponse.json({
    enqueued: pages.length,
    skipped,
    pages: pages.map((p) => ({ id: p.id, token: p.token })),
    mock,
  });
}
