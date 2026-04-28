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
