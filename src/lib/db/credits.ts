import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { profiles } from "./schema";
import {
  tryDeductCredits as rpcTryDeductCredits,
  refillCredits as rpcRefillCredits,
} from "./rpc";

export async function tryDeductCredits(
  userId: string,
  amount: number,
): Promise<boolean> {
  return rpcTryDeductCredits(userId, amount);
}

export async function refillCredits(
  userId: string,
  plan: string,
  credits: number,
  renewsAt: string,
): Promise<void> {
  return rpcRefillCredits(userId, plan, credits, renewsAt);
}

/**
 * Add `amount` credits to a user's balance. Used to refund a deduction
 * when the downstream operation it was paying for never started
 * (e.g. Sceneify rejected the call). Not for subscription refills —
 * use refillCredits for that.
 */
export async function addCredits(userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await db
    .update(profiles)
    .set({ creditsBalance: sql`${profiles.creditsBalance} + ${amount}` })
    .where(eq(profiles.id, userId));
}

export async function getCreditsBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ balance: profiles.creditsBalance })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row?.balance ?? 0;
}
