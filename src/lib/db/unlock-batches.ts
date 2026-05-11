import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import {
  generations,
  unlockBatches,
  type UnlockBatch,
  type UnlockBatchGeneration,
} from "./schema";

export type CreateBatchInput = {
  generations: UnlockBatchGeneration[];
  userId?: string | null;
  // Run that owns the generation rows (created in the same finalize-
  // batch transaction). Nullable for back-compat with old batches
  // that only existed as JSONB blobs.
  runId?: string | null;
};

export function newToken(): string {
  return randomBytes(16).toString("hex");
}

export async function createUnlockBatch(input: CreateBatchInput): Promise<string> {
  const token = newToken();
  await db.insert(unlockBatches).values({
    token,
    generations: input.generations,
    userId: input.userId ?? null,
    runId: input.runId ?? null,
  });
  return token;
}

export async function getUnlockBatchByToken(
  token: string,
): Promise<UnlockBatch | null> {
  const rows = await db
    .select()
    .from(unlockBatches)
    .where(eq(unlockBatches.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function attachStripeSessionToBatch(
  token: string,
  sessionId: string,
): Promise<void> {
  await db
    .update(unlockBatches)
    .set({ stripeSessionId: sessionId })
    .where(eq(unlockBatches.token, token));
}

/**
 * Attach an anonymous batch to a now-authenticated user. Idempotent and
 * race-safe: only updates when user_id is currently null AND token
 * matches, so a second OTP verification (or a tab-double-fire) won't
 * silently transfer the batch to a different user.
 */
export async function attachBatchToUser(
  token: string,
  userId: string,
): Promise<boolean> {
  const updated = await db
    .update(unlockBatches)
    .set({ userId })
    .where(and(eq(unlockBatches.token, token), isNull(unlockBatches.userId)))
    .returning({ token: unlockBatches.token });
  return updated.length > 0;
}

export async function markBatchPaid(args: {
  token: string;
  paymentIntent?: string | null;
  customerEmail?: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [batch] = await tx
      .update(unlockBatches)
      .set({
        status: "paid",
        paidAt: new Date(),
        stripePaymentIntent: args.paymentIntent ?? null,
        customerEmail: args.customerEmail ?? null,
      })
      .where(eq(unlockBatches.token, args.token))
      .returning({ runId: unlockBatches.runId });

    // Promote the watermarked output_url to the raw HD URL on every
    // generation in the batch. After this swap /app/library and any
    // other consumer that reads `output_url` naturally renders the
    // un-watermarked HD — no JOIN against unlock_batches needed.
    if (batch?.runId) {
      await tx
        .update(generations)
        .set({
          outputUrl: sql`${generations.rawUrl}`,
          watermarked: false,
          quality: "hd",
        })
        .where(
          and(
            eq(generations.runId, batch.runId),
            isNotNull(generations.rawUrl),
            eq(generations.watermarked, true),
          ),
        );
    }
  });
}
