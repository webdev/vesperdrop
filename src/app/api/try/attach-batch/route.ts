import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { runs, generations, unlockBatches } from "@/lib/db/schema";
import { getUnlockBatchByToken } from "@/lib/db/unlock-batches";

export const runtime = "nodejs";

// Called by the /try inline OTP flow once verifyOtp resolves. Re-
// parents the anonymous batch + its run + its generations to the
// now-authenticated user. The three updates run in a transaction so
// a partial failure leaves no orphans.
//
// Idempotent: if the batch is already attached to this user, returns
// ok:true. If it's attached to a different user (race / abuse),
// returns 409. If the token doesn't exist, returns 404.
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = z.object({ token: z.string().min(8).max(128) }).safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const batch = await getUnlockBatchByToken(parsed.data.token);
  if (!batch) {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }

  if (batch.userId === user.id) {
    return NextResponse.json({ ok: true, alreadyAttached: true });
  }

  if (batch.userId && batch.userId !== user.id) {
    return NextResponse.json(
      { error: "batch belongs to another account" },
      { status: 409 },
    );
  }

  const result = await db.transaction(async (tx) => {
    // Step 1: attach the batch row itself. Guarded on user_id IS NULL
    // so a concurrent retry can't transfer ownership to a different
    // user. If the row is already owned (race), we re-read below.
    const updatedBatch = await tx
      .update(unlockBatches)
      .set({ userId: user.id })
      .where(
        and(
          eq(unlockBatches.token, parsed.data.token),
          isNull(unlockBatches.userId),
        ),
      )
      .returning({ runId: unlockBatches.runId });
    if (updatedBatch.length === 0) return { batchAttached: false };

    const runId = updatedBatch[0].runId;
    if (!runId) {
      // Batch from before the DB-row migration — no run to re-parent.
      return { batchAttached: true, generationsUpdated: 0, runUpdated: false };
    }

    // Step 2: re-parent the run. WHERE clause guards on user_id IS
    // NULL so we never overwrite a real owner; also restricts to the
    // run referenced by this batch.
    const updatedRun = await tx
      .update(runs)
      .set({ userId: user.id })
      .where(and(eq(runs.id, runId), isNull(runs.userId)))
      .returning({ id: runs.id });

    // Step 3: re-parent all generations under the run. WHERE clause
    // guards on user_id IS NULL same way.
    const updatedGens = await tx
      .update(generations)
      .set({ userId: user.id })
      .where(
        and(eq(generations.runId, runId), isNull(generations.userId)),
      )
      .returning({ id: generations.id });

    return {
      batchAttached: true,
      runUpdated: updatedRun.length > 0,
      generationsUpdated: updatedGens.length,
    };
  });

  if (!result.batchAttached) {
    const refreshed = await getUnlockBatchByToken(parsed.data.token);
    if (refreshed?.userId === user.id) {
      return NextResponse.json({ ok: true, alreadyAttached: true });
    }
    return NextResponse.json(
      { error: "batch could not be attached" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    runUpdated: result.runUpdated,
    generationsUpdated: result.generationsUpdated,
  });
}
