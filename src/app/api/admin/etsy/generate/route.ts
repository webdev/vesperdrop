import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  getCandidatesByIds,
  setCandidatesStatus,
} from "@/lib/etsy-outreach/candidates";
import { createPreviewPage } from "@/lib/etsy-outreach/pages";
import { processEtsyPreview } from "@/lib/workflows/process-etsy-preview";

const Body = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(50),
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

  const pages = await Promise.all(
    candidates.map((c) => createPreviewPage({ candidate: c, createdBy: adminEmail })),
  );
  await setCandidatesStatus(candidateIds, "generating");

  // Fire and forget — workflow handles persistence end-to-end.
  void chunkAndRun(pages, CONCURRENCY, (p) => processEtsyPreview(p.id, mock)).catch(
    (e) => console.error("[etsy-outreach] batch failed", e),
  );

  return NextResponse.json({
    enqueued: pages.length,
    pages: pages.map((p) => ({ id: p.id, token: p.token })),
    mock,
  });
}
