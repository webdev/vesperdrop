import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { profiles } from "./schema";
import {
  tryConsumeQuota as rpcTryConsumeQuota,
  refillQuota as rpcRefillQuota,
} from "./rpc";

export async function tryConsumeQuota(
  userId: string,
  amount: number,
): Promise<boolean> {
  return rpcTryConsumeQuota(userId, amount);
}

export async function refillQuota(
  userId: string,
  plan: string,
  quotaUnits: number,
  renewsAt: string,
): Promise<void> {
  return rpcRefillQuota(userId, plan, quotaUnits, renewsAt);
}

export async function addQuota(userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await db
    .update(profiles)
    .set({ quotaUnitsBalance: sql`${profiles.quotaUnitsBalance} + ${amount}` })
    .where(eq(profiles.id, userId));
}

export async function getQuotaBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ balance: profiles.quotaUnitsBalance })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row?.balance ?? 0;
}
