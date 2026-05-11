import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./index";

export async function tryReserveQuota(
  userId: string,
  delta: number,
  cap: number,
): Promise<boolean> {
  const result = await db.execute<{ ok: boolean }>(
    sql`select public.try_reserve_quota(${userId}::uuid, ${delta}, ${cap}) as ok`,
  );
  return Boolean(result[0]?.ok);
}

export async function tryTakeToken(
  userId: string,
  bucket: string,
  capacity: number,
  refillPerMinute: number,
): Promise<boolean> {
  const result = await db.execute<{ ok: boolean }>(
    sql`select public.try_take_token(${userId}::uuid, ${bucket}, ${capacity}, ${refillPerMinute}) as ok`,
  );
  return Boolean(result[0]?.ok);
}

export async function incrementUsage(
  userId: string,
  yearMonth: string,
  delta: number,
): Promise<void> {
  await db.execute(
    sql`select public.increment_usage(${userId}::uuid, ${yearMonth}, ${delta})`,
  );
}

export async function tryConsumeQuota(
  userId: string,
  amount: number,
): Promise<boolean> {
  const result = await db.execute<{ ok: boolean }>(
    sql`select public.try_consume_quota(${userId}::uuid, ${amount}) as ok`,
  );
  return Boolean(result[0]?.ok);
}

export async function tryConsumeAnonCredit(anonId: string): Promise<boolean> {
  const result = await db.execute<{ ok: boolean }>(
    sql`select public.try_consume_anon_credit(${anonId}::uuid) as ok`,
  );
  return Boolean(result[0]?.ok);
}

export async function refillQuota(
  userId: string,
  plan: string,
  quotaUnits: number,
  renewsAt: string | null,
): Promise<void> {
  await db.execute(
    sql`select public.refill_quota(${userId}::uuid, ${plan}, ${quotaUnits}, ${renewsAt}::timestamptz)`,
  );
}
