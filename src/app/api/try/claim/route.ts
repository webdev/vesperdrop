import { NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { runs, generations } from "@/lib/db/schema";
import { TryClaimSchema } from "@/lib/schema/runs";
import { getPostHogClient } from "@/lib/posthog-server";
import { copyToPrivate } from "@/lib/storage";

export const runtime = "nodejs";

const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || b.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_LIMIT) return false;
  b.count += 1;
  return true;
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (!rateLimitOk(ip)) {
    return NextResponse.json(
      { error: "Too many claims. Wait a minute and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = TryClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const incoming = parsed.data.generations;

  // Light dedup: if the user posted any claim in the last 30s with the same
  // generation count, treat it as a double-submit and return the most recent
  // runId. The client has its own claimRanRef guard; this is belt-and-braces.
  const cutoff = new Date(Date.now() - 30_000);
  const recentRuns = await db
    .select({ id: runs.id, totalImages: runs.totalImages })
    .from(runs)
    .where(and(eq(runs.userId, user.id), gte(runs.createdAt, cutoff)))
    .orderBy(desc(runs.createdAt))
    .limit(1);

  if (recentRuns.length > 0 && recentRuns[0].totalImages === incoming.length) {
    return NextResponse.json({
      runId: recentRuns[0].id,
      generationCount: recentRuns[0].totalImages,
    });
  }

  // Copy each output's bytes from the public preview Blob to a private Blob.
  // Failure aborts the claim — partial state is worse than a retry.
  let privateOutputUrls: string[];
  let privateSourceUrl = "";
  try {
    privateOutputUrls = await Promise.all(
      incoming.map((g) => copyToPrivate(g.outputUrl, "watermarked-private")),
    );
    if (parsed.data.source?.url) {
      privateSourceUrl = await copyToPrivate(
        parsed.data.source.url,
        "sources-private",
      );
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: "failed to persist images",
        detail: e instanceof Error ? e.message : "unknown",
      },
      { status: 502 },
    );
  }

  const now = new Date();
  const runId = await db.transaction(async (tx) => {
    const [runRow] = await tx
      .insert(runs)
      .values({
        userId: user.id,
        sourceCount: 1,
        presetCount: incoming.length,
        totalImages: incoming.length,
      })
      .returning({ id: runs.id });

    await tx.insert(generations).values(
      incoming.map((g, i) => ({
        runId: runRow.id,
        userId: user.id,
        sceneifySourceId: privateSourceUrl,
        presetId: g.sceneSlug,
        status: "succeeded" as const,
        outputUrl: privateOutputUrls[i],
        watermarked: true,
        quality: "preview" as const,
        completedAt: now,
      })),
    );

    return runRow.id;
  });

  getPostHogClient().capture({
    distinctId: user.id,
    event: "try_claim_persisted",
    properties: {
      run_id: runId,
      generation_count: incoming.length,
      requested_count: parsed.data.generations.length,
    },
  });

  return NextResponse.json({ runId, generationCount: incoming.length });
}
