import "server-only";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { EtsyCandidate, EtsyPreviewPage } from "@/lib/db/schema";
import { generatePreviewToken } from "./tokens";

export type PreviewSlotKey = "hero" | "lifestyle" | "detail";
export type PreviewStatus = EtsyPreviewPage["status"];

export async function createPreviewPage(args: {
  candidate: EtsyCandidate;
  createdBy: string;
}): Promise<EtsyPreviewPage> {
  const [row] = await db
    .insert(schema.etsyPreviewPages)
    .values({
      candidateId: args.candidate.id,
      token: generatePreviewToken(),
      createdBy: args.createdBy,
      listingSnapshot: {
        title: args.candidate.title,
        listingUrl: args.candidate.listingUrl,
        imageUrl: args.candidate.imageUrl,
        shopName: args.candidate.shopName,
        category: args.candidate.category,
      },
    })
    .returning();
  return row;
}

export async function getPreviewById(id: string): Promise<EtsyPreviewPage | null> {
  const rows = await db
    .select()
    .from(schema.etsyPreviewPages)
    .where(eq(schema.etsyPreviewPages.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPreviewByToken(
  token: string,
): Promise<EtsyPreviewPage | null> {
  const rows = await db
    .select()
    .from(schema.etsyPreviewPages)
    .where(eq(schema.etsyPreviewPages.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPreviewsByCandidateIds(
  candidateIds: string[],
): Promise<EtsyPreviewPage[]> {
  if (candidateIds.length === 0) return [];
  return db
    .select()
    .from(schema.etsyPreviewPages)
    .where(inArray(schema.etsyPreviewPages.candidateId, candidateIds))
    .orderBy(desc(schema.etsyPreviewPages.createdAt));
}

export async function updatePreviewSourceBlob(
  id: string,
  sourceBlobUrl: string,
): Promise<void> {
  await db
    .update(schema.etsyPreviewPages)
    .set({ sourceBlobUrl, updatedAt: sql`now()` })
    .where(eq(schema.etsyPreviewPages.id, id));
}

export async function setSlotRunning(
  id: string,
  slot: PreviewSlotKey,
): Promise<void> {
  const setMap = {
    hero: { heroStatus: "running" as const },
    lifestyle: { lifestyleStatus: "running" as const },
    detail: { detailStatus: "running" as const },
  };
  await db
    .update(schema.etsyPreviewPages)
    .set({ ...setMap[slot], status: "generating", updatedAt: sql`now()` })
    .where(eq(schema.etsyPreviewPages.id, id));
}

export async function setSlotResult(
  id: string,
  slot: PreviewSlotKey,
  result: { url: string } | { error: string },
): Promise<void> {
  const isError = "error" in result;
  const update =
    slot === "hero"
      ? isError
        ? { heroStatus: "failed" as const, heroError: result.error }
        : { heroStatus: "succeeded" as const, heroUrl: result.url, heroError: null }
      : slot === "lifestyle"
        ? isError
          ? { lifestyleStatus: "failed" as const, lifestyleError: result.error }
          : { lifestyleStatus: "succeeded" as const, lifestyleUrl: result.url, lifestyleError: null }
        : isError
          ? { detailStatus: "failed" as const, detailError: result.error }
          : { detailStatus: "succeeded" as const, detailUrl: result.url, detailError: null };
  await db
    .update(schema.etsyPreviewPages)
    .set({ ...update, updatedAt: sql`now()` })
    .where(eq(schema.etsyPreviewPages.id, id));
}

export async function finalizePreviewStatus(id: string): Promise<PreviewStatus> {
  const page = await getPreviewById(id);
  if (!page) throw new Error(`preview ${id} not found`);
  const slots = [page.heroStatus, page.lifestyleStatus, page.detailStatus];
  const succeededCount = slots.filter((s) => s === "succeeded").length;
  const failedCount = slots.filter((s) => s === "failed").length;
  let next: PreviewStatus;
  if (succeededCount === 3) next = "completed";
  else if (succeededCount >= 1 && failedCount >= 1) next = "partial";
  else if (failedCount === 3) next = "failed";
  else next = page.status;
  await db
    .update(schema.etsyPreviewPages)
    .set({
      status: next,
      completedAt: next === "completed" || next === "partial" || next === "failed"
        ? sql`now()`
        : null,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.etsyPreviewPages.id, id));
  return next;
}

export async function resetAllSlots(id: string): Promise<void> {
  await db
    .update(schema.etsyPreviewPages)
    .set({
      status: "pending",
      heroStatus: "pending",
      heroUrl: null,
      heroError: null,
      lifestyleStatus: "pending",
      lifestyleUrl: null,
      lifestyleError: null,
      detailStatus: "pending",
      detailUrl: null,
      detailError: null,
      completedAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.etsyPreviewPages.id, id));
}

export async function resetFailedSlots(id: string): Promise<void> {
  const page = await getPreviewById(id);
  if (!page) throw new Error(`preview ${id} not found`);
  await db
    .update(schema.etsyPreviewPages)
    .set({
      status: "pending",
      heroStatus: page.heroStatus === "failed" ? "pending" : page.heroStatus,
      lifestyleStatus:
        page.lifestyleStatus === "failed" ? "pending" : page.lifestyleStatus,
      detailStatus: page.detailStatus === "failed" ? "pending" : page.detailStatus,
      heroError: page.heroStatus === "failed" ? null : page.heroError,
      lifestyleError: page.lifestyleStatus === "failed" ? null : page.lifestyleError,
      detailError: page.detailStatus === "failed" ? null : page.detailError,
      completedAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.etsyPreviewPages.id, id));
}
