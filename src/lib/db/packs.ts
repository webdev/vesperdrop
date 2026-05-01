import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import { completeLookPacks, generations } from "./schema";
import type { SceneifyPackPlatform, SceneifyPackShot } from "@/lib/ai/sceneify";

export interface PendingShotInsert {
  sceneifyGenerationId: string;
  role: string;
  shotIndex: number;
}

export interface CreatePackInput {
  runId: string;
  parentGenerationId: string;
  parentSceneifySourceId: string;
  parentPresetId: string;
  userId: string;
  platform: SceneifyPackPlatform;
  sceneifyPackId: string;
  shots: PendingShotInsert[];
  creditsSpent: number;
}

export async function createPackWithShots(input: CreatePackInput) {
  return db.transaction(async (tx) => {
    const [pack] = await tx
      .insert(completeLookPacks)
      .values({
        runId: input.runId,
        parentGenerationId: input.parentGenerationId,
        userId: input.userId,
        platform: input.platform,
        sceneifyPackId: input.sceneifyPackId,
        shotCount: input.shots.length,
        creditsSpent: input.creditsSpent,
        status: "pending",
      })
      .returning();

    const shotRows = await tx
      .insert(generations)
      .values(
        input.shots.map((s) => ({
          runId: input.runId,
          userId: input.userId,
          sceneifySourceId: input.parentSceneifySourceId,
          sceneifyGenerationId: s.sceneifyGenerationId,
          presetId: input.parentPresetId,
          parentGenerationId: input.parentGenerationId,
          packId: pack.id,
          packRole: s.role,
          packShotIndex: s.shotIndex,
          status: "pending" as const,
          watermarked: false,
          quality: "hd" as const,
        })),
      )
      .returning();

    return { pack, shots: shotRows };
  });
}

export async function getPackForUser(packId: string, userId: string) {
  const [row] = await db
    .select()
    .from(completeLookPacks)
    .where(
      and(eq(completeLookPacks.id, packId), eq(completeLookPacks.userId, userId)),
    );
  return row ?? null;
}

export async function listPackShots(packId: string) {
  return db
    .select()
    .from(generations)
    .where(eq(generations.packId, packId))
    .orderBy(asc(generations.packShotIndex));
}

export async function listPacksForRun(runId: string, userId: string) {
  return db
    .select()
    .from(completeLookPacks)
    .where(
      and(eq(completeLookPacks.runId, runId), eq(completeLookPacks.userId, userId)),
    )
    .orderBy(asc(completeLookPacks.createdAt));
}

export async function findExistingPack(
  parentGenerationId: string,
  platform: SceneifyPackPlatform,
) {
  const [row] = await db
    .select()
    .from(completeLookPacks)
    .where(
      and(
        eq(completeLookPacks.parentGenerationId, parentGenerationId),
        eq(completeLookPacks.platform, platform),
      ),
    );
  return row ?? null;
}

/**
 * Reconcile our pending pack-shot rows against Sceneify's status payload.
 * Skips shots already in a terminal state on our side.
 */
export async function syncPackShotsFromSceneify(
  packId: string,
  sceneifyShots: SceneifyPackShot[],
) {
  const ours = await listPackShots(packId);
  const byScn = new Map(ours.map((r) => [r.sceneifyGenerationId, r]));

  for (const s of sceneifyShots) {
    const local = byScn.get(s.generationId);
    if (!local) continue;
    if (local.status === "succeeded" || local.status === "failed") continue;

    const patch: Record<string, unknown> = {};
    if (s.status === "succeeded") {
      patch.status = "succeeded";
      if (s.outputUrl) patch.outputUrl = s.outputUrl;
      patch.completedAt = new Date();
    } else if (s.status === "failed") {
      patch.status = "failed";
      if (s.error) patch.error = s.error;
      patch.completedAt = new Date();
    } else if (s.status === "running" && local.status !== "running") {
      patch.status = "running";
    }
    if (Object.keys(patch).length === 0) continue;
    await db.update(generations).set(patch).where(eq(generations.id, local.id));
  }
}

export async function updatePackStatus(
  packId: string,
  status: "pending" | "running" | "succeeded" | "partial" | "failed",
) {
  await db
    .update(completeLookPacks)
    .set({ status, updatedAt: new Date() })
    .where(eq(completeLookPacks.id, packId));
}

/**
 * Derive the pack's status from the count of succeeded vs failed shot rows.
 */
export function derivePackStatus(opts: {
  total: number;
  succeeded: number;
  failed: number;
}): "running" | "succeeded" | "partial" | "failed" {
  const { total, succeeded, failed } = opts;
  const pending = total - succeeded - failed;
  if (pending > 0) return "running";
  if (failed === 0) return "succeeded";
  if (succeeded === 0) return "failed";
  return "partial";
}
