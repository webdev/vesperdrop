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
  return Boolean(result.rows[0]?.ok);
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
  return Boolean(result.rows[0]?.ok);
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

export async function tryDeductCredits(
  userId: string,
  amount: number,
): Promise<boolean> {
  const result = await db.execute<{ ok: boolean }>(
    sql`select public.try_deduct_credits(${userId}::uuid, ${amount}) as ok`,
  );
  return Boolean(result.rows[0]?.ok);
}

export async function refillCredits(
  userId: string,
  plan: string,
  credits: number,
  renewsAt: string | null,
): Promise<void> {
  await db.execute(
    sql`select public.refill_credits(${userId}::uuid, ${plan}, ${credits}, ${renewsAt}::timestamptz)`,
  );
}
