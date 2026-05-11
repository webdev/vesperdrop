import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { anonCredits } from "./schema";
import { tryConsumeAnonCredit as rpcTryConsumeAnonCredit } from "./rpc";

export const ANON_COOKIE_NAME = "vd_try_anon";
// 1 year — long enough that returning visitors keep their ledger;
// short enough that an idle browser eventually resets.
export const ANON_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
// Default allowance: one full /try batch = 3 generations.
export const ANON_DEFAULT_CREDITS = 3;

/**
 * Returns the existing anon credit row, or creates one if missing.
 * The caller is responsible for setting the cookie on the response.
 */
export async function getOrCreateAnonCredit(
  cookieAnonId: string | undefined,
): Promise<{ anonId: string; created: boolean }> {
  if (cookieAnonId) {
    const [existing] = await db
      .select({ anonId: anonCredits.anonId })
      .from(anonCredits)
      .where(eq(anonCredits.anonId, cookieAnonId))
      .limit(1);
    if (existing) return { anonId: existing.anonId, created: false };
  }
  // No cookie OR cookie pointed at a row that doesn't exist (e.g.,
  // the row was reaped). Mint a fresh row; the DB default fills in
  // credits_remaining + uuid.
  const [row] = await db
    .insert(anonCredits)
    .values({})
    .returning({ anonId: anonCredits.anonId });
  return { anonId: row.anonId, created: true };
}

/**
 * Atomic decrement. Returns true if a credit was consumed, false if
 * the ledger is at zero. Mirrors tryConsumeQuota's contract.
 */
export async function tryConsumeAnonCredit(anonId: string): Promise<boolean> {
  return rpcTryConsumeAnonCredit(anonId);
}
