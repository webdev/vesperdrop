import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import { unlockBatches, type UnlockBatch, type UnlockBatchGeneration } from "./schema";

export type CreateBatchInput = {
  generations: UnlockBatchGeneration[];
  userId?: string | null;
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
  await db
    .update(unlockBatches)
    .set({
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntent: args.paymentIntent ?? null,
      customerEmail: args.customerEmail ?? null,
    })
    .where(eq(unlockBatches.token, args.token));
}
