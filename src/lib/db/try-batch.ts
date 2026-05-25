import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { generations, runs, unlockBatches } from "./schema";
import type { UnlockBatchGeneration } from "./schema";
import type { FocalPoint, FaceBox } from "@/lib/ai/sceneify";
import { flushPendingBatchEmail } from "@/lib/email/deferred-send";

// Server-side per-tile persistence for the /try generate flow (VES-53).
//
// Background
// ----------
// /api/try/generate streams one SSE response per scene tile, awaiting a
// blocking Sceneify call (~60-70s). Historically NOTHING was persisted
// here — the browser held the generated URLs and POSTed them to
// /api/try/finalize-batch only after every tile settled. So if a visitor
// submitted their email mid-generation and then closed the tab, finalize
// never ran, no run/generations were written, and the deferred email
// (flushPendingBatchEmail, which needs a linked run with succeeded tiles)
// could never fire. The "we'll email you, you can leave" promise silently
// failed for exactly the people it was for.
//
// Fix
// ---
// Persist each tile server-side as it completes, keyed by the client-minted
// batch token, decoupled from the client. The generate route wraps these
// writes in next/server `after()` so they survive the client disconnecting
// (the Sceneify call already continues server-side because the route never
// wired req.signal to it). When the last tile of a batch settles we link
// the run to unlock_batches and call flushPendingBatchEmail — zero client
// involvement.
//
// Idempotency
// -----------
// - ONE run per batch token: ensureBatchRun upserts the unlock_batches stub
//   and creates the run only if the token has none linked yet. The client's
//   finalize-batch reuses that same run instead of minting a second one.
// - ONE generation row per (run_id, preset_id): recordTile upserts on that
//   unique key, so the server tile-complete write and a later client
//   finalize converge on the same row (no duplicates).
// - email_sent_at latch (in deferred-send) guarantees a single email even
//   if both the server completion path AND the client finalize flush fire.

export type TilePersistInput = {
  token: string;
  userId?: string | null;
  sceneSlug: string;
  sceneName: string;
  isFreePreview: boolean;
  sourceUrl: string;
  /** Total tiles the client launched for this batch — completion sentinel. */
  batchSize: number;
};

export type TileSuccess = TilePersistInput & {
  outputUrl: string; // watermarked preview
  rawUrl: string | null; // un-watermarked HD
  focalPoint: FocalPoint | null;
  faceBox: FaceBox | null;
};

/**
 * Ensure a run exists for this batch token and return its id. Idempotent
 * and concurrency-safe: N tiles for the same token race here, but only the
 * first creates the run; the rest read the linked run_id back. We do this
 * inside a transaction with an upsert on the unlock_batches stub so the
 * token row always exists before generations point at the run.
 *
 * `batchSize` is recorded as `expected_tiles` so maybeFinalizeBatch knows
 * when every tile has settled without the client telling it.
 */
export async function ensureBatchRun(args: {
  token: string;
  userId?: string | null;
  batchSize: number;
}): Promise<string> {
  return db.transaction(async (tx) => {
    // Lock the batch row (or create the stub) first so concurrent tiles
    // serialize on it and exactly one wins the run creation.
    await tx
      .insert(unlockBatches)
      .values({
        token: args.token,
        generations: [],
        userId: args.userId ?? null,
        expectedTiles: args.batchSize,
      })
      .onConflictDoUpdate({
        target: unlockBatches.token,
        // Keep expected_tiles fresh (a re-run could change scene count) but
        // never clobber a linked run / pending email / sent latch.
        set: { expectedTiles: args.batchSize },
      });

    const [batch] = await tx
      .select({ runId: unlockBatches.runId })
      .from(unlockBatches)
      .where(eq(unlockBatches.token, args.token))
      .limit(1)
      .for("update");

    if (batch?.runId) return batch.runId;

    const [runRow] = await tx
      .insert(runs)
      .values({
        userId: args.userId ?? null,
        sourceCount: 1,
        presetCount: args.batchSize,
        totalImages: args.batchSize,
      })
      .returning({ id: runs.id });

    await tx
      .update(unlockBatches)
      .set({ runId: runRow.id })
      .where(and(eq(unlockBatches.token, args.token), sql`${unlockBatches.runId} IS NULL`));

    return runRow.id;
  });
}

/**
 * Persist a succeeded tile. Upserts the generation row on (run_id,
 * preset_id) so the server completion write and a later client finalize
 * converge on a single row. Returns the run id so callers can finalize.
 */
export async function recordTileSuccess(input: TileSuccess): Promise<string> {
  const runId = await ensureBatchRun({
    token: input.token,
    userId: input.userId,
    batchSize: input.batchSize,
  });

  await db
    .insert(generations)
    .values({
      runId,
      userId: input.userId ?? null,
      sceneifySourceId: input.sourceUrl,
      presetId: input.sceneSlug,
      status: "succeeded",
      outputUrl: input.outputUrl,
      rawUrl: input.rawUrl,
      watermarked: true,
      quality: "preview",
      focalPoint: input.focalPoint,
      faceBox: input.faceBox,
      completedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [generations.runId, generations.presetId],
      targetWhere: sql`${generations.packId} is null`,
      set: {
        status: "succeeded",
        outputUrl: input.outputUrl,
        rawUrl: input.rawUrl,
        watermarked: true,
        quality: "preview",
        focalPoint: input.focalPoint,
        faceBox: input.faceBox,
        completedAt: new Date(),
      },
    });

  return runId;
}

// Retryable failures are tagged in the generations.error text so a later
// finalize can tell a transient (5xx, client will auto-retry) failure apart
// from a permanent one WITHOUT a new schema column. maybeFinalizeBatch reads
// this to decide whether to hold the flush open for a grace window. We only
// have a clear retryable signal for Sceneify 5xx; everything else (and the
// no-signal case) is treated as retryable since the grace is bounded anyway.
const RETRYABLE_ERROR_PREFIX = "[retryable] ";

function isRetryableError(error: string | null): boolean {
  return error?.startsWith(RETRYABLE_ERROR_PREFIX) ?? false;
}

/**
 * Persist a failed tile so the batch can still settle (and the deferred
 * email can send whatever succeeded) instead of hanging forever waiting
 * for a tile that will never arrive.
 *
 * `retryable` records whether the client is expected to auto-retry this
 * tile (transient Sceneify 5xx). maybeFinalizeBatch uses it to hold the
 * deferred-email flush open for a short grace window so a retry's success
 * can be included before we email a smaller-than-final set (VES-53).
 */
export async function recordTileFailure(
  input: TilePersistInput & { error: string; retryable: boolean },
): Promise<string> {
  const runId = await ensureBatchRun({
    token: input.token,
    userId: input.userId,
    batchSize: input.batchSize,
  });

  const taggedError = (
    input.retryable ? RETRYABLE_ERROR_PREFIX + input.error : input.error
  ).slice(0, 500);

  await db
    .insert(generations)
    .values({
      runId,
      userId: input.userId ?? null,
      sceneifySourceId: input.sourceUrl,
      presetId: input.sceneSlug,
      status: "failed",
      watermarked: true,
      quality: "preview",
      error: taggedError,
      completedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [generations.runId, generations.presetId],
      targetWhere: sql`${generations.packId} is null`,
      // A later success (auto-retry) MUST be allowed to overwrite a failure,
      // but we never downgrade an already-succeeded row back to failed.
      set: {
        status: sql`CASE WHEN ${generations.status} = 'succeeded' THEN ${generations.status} ELSE 'failed' END`,
        error: taggedError,
        completedAt: new Date(),
      },
    });

  return runId;
}

export type FinalizeResult =
  // Not every tile has settled yet — nothing to do.
  | { status: "pending" }
  // Settled set includes a retryable failure and not all tiles succeeded;
  // the flush is being held open for a grace window so a client auto-retry's
  // success can be included. The caller should schedule a single delayed
  // re-check with { afterGrace: true }. (Never returned when afterGrace is
  // set — the grace only ever fires once.)
  | { status: "grace" }
  // The batch was finalized: JSONB filled (when there were succeeded tiles)
  // and the deferred email flush attempted (latch makes it single-send).
  | { status: "finalized" };

/**
 * If every tile of the batch has settled (succeeded or failed), refresh the
 * unlock_batches JSONB payload from the persisted generation rows and flush
 * any pending mid-generation email. Safe to call after every tile — it's a
 * no-op until the settled count reaches expected_tiles, and the email latch
 * makes the flush idempotent.
 *
 * Grace window (VES-53): a *retryable* failure (transient Sceneify 5xx) can
 * settle the batch and trigger the flush BEFORE the client's auto-retry has
 * landed — emailing a smaller set than ends up on screen. When the settled
 * set includes a retryable failure and not every tile succeeded, we return
 * `grace` instead of flushing and let the caller re-check after a bounded
 * delay (`afterGrace: true`), giving the retry time to overwrite the failed
 * row with a success. The grace is bounded, so the batch still settles on
 * tab-close (no permanent hang) — the re-check finalizes with whatever
 * succeeded by then. The email latch keeps the eventual send single.
 */
export async function maybeFinalizeBatch(
  token: string,
  runId: string,
  opts?: { afterGrace?: boolean },
): Promise<FinalizeResult> {
  const [batch] = await db
    .select({ expectedTiles: unlockBatches.expectedTiles })
    .from(unlockBatches)
    .where(eq(unlockBatches.token, token))
    .limit(1);
  const expected = batch?.expectedTiles ?? null;
  if (!expected) return { status: "pending" };

  const rows = await db
    .select({
      presetId: generations.presetId,
      status: generations.status,
      error: generations.error,
      outputUrl: generations.outputUrl,
      rawUrl: generations.rawUrl,
      focalPoint: generations.focalPoint,
      faceBox: generations.faceBox,
    })
    .from(generations)
    .where(eq(generations.runId, runId));

  const settled = rows.filter((r) => r.status === "succeeded" || r.status === "failed");
  if (settled.length < expected) return { status: "pending" };

  // Hold the flush for a grace window if the settled set still has a
  // retryable failure AND not everything succeeded — a pending client retry
  // may yet turn that failure into a success we'd want to email. Skipped
  // when afterGrace (the grace already elapsed) so the batch always settles.
  const hasRetryableFailure = rows.some(
    (r) => r.status === "failed" && isRetryableError(r.error),
  );
  const allSucceeded = rows.every((r) => r.status === "succeeded");
  if (!opts?.afterGrace && hasRetryableFailure && !allSucceeded) {
    return { status: "grace" };
  }

  // Build the JSONB payload from the succeeded tiles so /try/b/<token>
  // renders even on a tab-closed batch the client never finalized. Index 0
  // = the first succeeded tile (the free preview is always launched first).
  const succeeded = rows.filter((r) => r.status === "succeeded" && r.outputUrl);
  if (succeeded.length === 0) {
    // Nothing usable to render/email; still attempt the flush so the latch
    // logic (no_photos → release) runs and observability is recorded.
    await flushPendingBatchEmail(token);
    return { status: "finalized" };
  }

  const stored: UnlockBatchGeneration[] = succeeded.map((r, i) => ({
    sceneSlug: r.presetId,
    sceneName: r.presetId,
    outputUrl: r.outputUrl as string,
    rawUrl: r.rawUrl ?? null,
    isBonus: false,
    isFreePreview: i === 0,
    focalPoint: r.focalPoint ?? null,
    faceBox: r.faceBox ?? null,
  }));

  // Only fill the JSONB when the client hasn't already finalized a richer
  // payload (it carries sceneName + the user-picked free-preview flag). We
  // detect that by checking whether generations is still the empty stub.
  await db
    .update(unlockBatches)
    .set({ generations: stored })
    .where(
      and(
        eq(unlockBatches.token, token),
        sql`jsonb_array_length(${unlockBatches.generations}) = 0`,
      ),
    );

  await flushPendingBatchEmail(token);
  return { status: "finalized" };
}

// Bounded grace window for retryable tile failures (VES-53). When a tile
// fails with a retryable error and settling the batch would finalize before
// the client's auto-retry lands, the generate route schedules ONE delayed
// re-check via after() + sleep, then re-runs maybeFinalizeBatch with
// afterGrace so it settles regardless. Capped well under the function's max
// duration (the generate function already lives ~60-70s; maxDuration is
// 300s) so the lambda is guaranteed to outlive the wait.
export const GRACE_WINDOW_MS = 25_000;

// In-process guard so a single warm invocation doesn't queue several
// overlapping grace timers for the same batch. Cross-invocation duplicates
// are harmless — the email_sent_at latch makes the eventual send single — so
// this is just resource hygiene, not a correctness mechanism.
const scheduledGraceTimers = new Set<string>();

/**
 * Run a single bounded grace delay then re-finalize the batch, settling it
 * with whatever succeeded by then. Returns false (and does nothing) if a
 * grace timer for this token is already in flight within this invocation.
 * `sleep` is injectable so tests can run the grace without real time.
 */
export async function runFinalizeGrace(
  token: string,
  runId: string,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<boolean> {
  if (scheduledGraceTimers.has(token)) return false;
  scheduledGraceTimers.add(token);
  try {
    await sleep(GRACE_WINDOW_MS);
    await maybeFinalizeBatch(token, runId, { afterGrace: true });
    return true;
  } finally {
    scheduledGraceTimers.delete(token);
  }
}
