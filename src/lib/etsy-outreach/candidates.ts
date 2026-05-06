import "server-only";
import { eq, inArray, desc, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { ParsedCandidate } from "./parse-md";
import type { EtsyCandidate } from "@/lib/db/schema";

export type CandidateStatus = EtsyCandidate["status"];

export async function upsertCandidatesFromParsed(
  parsed: ParsedCandidate[],
): Promise<{ inserted: number; updated: number }> {
  if (parsed.length === 0) return { inserted: 0, updated: 0 };
  const rows = parsed.map((p) => ({
    listingUrl: p.listingUrl,
    title: p.title,
    imageUrl: p.imageUrl,
    shopName: p.shopName,
    shopUrl: p.shopUrl,
    category: p.category,
    rawMd: p.rawMd,
  }));
  const result = await db
    .insert(schema.etsyCandidates)
    .values(rows)
    .onConflictDoUpdate({
      target: schema.etsyCandidates.listingUrl,
      set: {
        title: sql`excluded.title`,
        imageUrl: sql`excluded.image_url`,
        shopName: sql`excluded.shop_name`,
        shopUrl: sql`excluded.shop_url`,
        category: sql`excluded.category`,
        rawMd: sql`excluded.raw_md`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: schema.etsyCandidates.id });
  return { inserted: result.length, updated: 0 };
}

export async function deleteAllCandidates(): Promise<number> {
  const result = await db
    .delete(schema.etsyCandidates)
    .returning({ id: schema.etsyCandidates.id });
  return result.length;
}

export async function listCandidates(): Promise<EtsyCandidate[]> {
  return db
    .select()
    .from(schema.etsyCandidates)
    .orderBy(desc(schema.etsyCandidates.updatedAt));
}

export async function getCandidatesByIds(ids: string[]): Promise<EtsyCandidate[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(schema.etsyCandidates)
    .where(inArray(schema.etsyCandidates.id, ids));
}

export async function setCandidateStatus(
  id: string,
  status: CandidateStatus,
): Promise<void> {
  await db
    .update(schema.etsyCandidates)
    .set({ status, updatedAt: sql`now()` })
    .where(eq(schema.etsyCandidates.id, id));
}

export async function setCandidatesStatus(
  ids: string[],
  status: CandidateStatus,
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(schema.etsyCandidates)
    .set({ status, updatedAt: sql`now()` })
    .where(inArray(schema.etsyCandidates.id, ids));
}
