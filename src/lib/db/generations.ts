import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import { generations } from "./schema";

export async function insertPendingGenerations(
  rows: Array<{
    runId: string;
    userId: string;
    sceneifySourceId: string;
    presetId: string;
  }>,
) {
  const inserted = await db
    .insert(generations)
    .values(
      rows.map((r) => ({
        runId: r.runId,
        userId: r.userId,
        sceneifySourceId: r.sceneifySourceId,
        presetId: r.presetId,
      })),
    )
    .returning({
      id: generations.id,
      preset_id: generations.presetId,
      sceneify_source_id: generations.sceneifySourceId,
    });
  return inserted;
}

export async function updateGeneration(
  id: string,
  patch: {
    status?: "running" | "succeeded" | "failed";
    sceneifyGenerationId?: string;
    sceneifySourceId?: string;
    outputUrl?: string;
    watermarked?: boolean;
    error?: string;
    completedAt?: string;
    modelUsed?: string;
  },
) {
  const update: Record<string, unknown> = {};
  if (patch.status) update.status = patch.status;
  if (patch.sceneifyGenerationId)
    update.sceneifyGenerationId = patch.sceneifyGenerationId;
  if (patch.sceneifySourceId) update.sceneifySourceId = patch.sceneifySourceId;
  if (patch.outputUrl) update.outputUrl = patch.outputUrl;
  if (patch.watermarked !== undefined) update.watermarked = patch.watermarked;
  if (patch.error) update.error = patch.error;
  if (patch.completedAt) update.completedAt = new Date(patch.completedAt);
  if (patch.modelUsed) update.modelUsed = patch.modelUsed;
  await db.update(generations).set(update).where(eq(generations.id, id));
}

export async function listGenerationsForRun(runId: string, userId: string) {
  return db
    .select()
    .from(generations)
    .where(and(eq(generations.runId, runId), eq(generations.userId, userId)))
    .orderBy(asc(generations.createdAt));
}
