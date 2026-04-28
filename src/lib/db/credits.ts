import "server-only";
import { eq } from "drizzle-orm";
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

export async function getCreditsBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ balance: profiles.creditsBalance })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row?.balance ?? 0;
}
