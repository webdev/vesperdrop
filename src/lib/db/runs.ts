import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { runs } from "./schema";

export async function createRun(params: {
  userId: string;
  sourceCount: number;
  presetCount: number;
}) {
  const totalImages = params.sourceCount * params.presetCount;
  const [row] = await db
    .insert(runs)
    .values({
      userId: params.userId,
      sourceCount: params.sourceCount,
      presetCount: params.presetCount,
      totalImages,
    })
    .returning({ id: runs.id });
  return { id: row.id, totalImages };
}

export async function getRunForUser(runId: string, userId: string) {
  const [row] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.id, runId), eq(runs.userId, userId)));
  if (!row) throw new Error("run not found");
  return row;
}

/**
 * Hard-delete a run and (via FK cascade) its generations and packs.
 * Returns true when a row was deleted, false when the run doesn't exist
 * or isn't owned by this user. Blob assets are intentionally left in
 * place — a separate sweep should reap them — so the delete stays fast
 * and DB-only.
 */
export async function deleteRunForUser(
  runId: string,
  userId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(runs)
    .where(and(eq(runs.id, runId), eq(runs.userId, userId)))
    .returning({ id: runs.id });
  return deleted.length > 0;
}

export const RUN_NAME_MAX_LENGTH = 80;

/**
 * Update a run's user-set name. Pass null (or an empty string) to clear it.
 * Returns true when a row was updated, false when the run doesn't exist or
 * isn't owned by this user. Throws on validation failure.
 */
export async function renameRunForUser(
  runId: string,
  userId: string,
  rawName: string | null,
): Promise<boolean> {
  let value: string | null;
  if (rawName == null) {
    value = null;
  } else {
    const trimmed = rawName.trim();
    if (trimmed.length === 0) value = null;
    else if (trimmed.length > RUN_NAME_MAX_LENGTH) {
      throw new Error(`name exceeds ${RUN_NAME_MAX_LENGTH} characters`);
    } else value = trimmed;
  }

  const updated = await db
    .update(runs)
    .set({ name: value })
    .where(and(eq(runs.id, runId), eq(runs.userId, userId)))
    .returning({ id: runs.id });
  return updated.length > 0;
}
