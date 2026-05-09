import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { IgPreview } from "@/lib/db/schema";
import { generatePreviewSlug } from "./slug";

export type IgPreviewStatus = IgPreview["status"];
export type IgPreviewOutput = IgPreview["outputs"][number];

type SourceImage = { url: string; name: string; mimeType: string };

export async function createIgPreview(args: {
  presetSlug: string;
  sourceImages: SourceImage[];
  presetSlugs: string[];
  expectedOutputCount: number;
  notes: string | null;
  createdBy: string;
  title?: string | null;
}): Promise<IgPreview> {
  const slug = generatePreviewSlug();
  const [row] = await db
    .insert(schema.igPreviews)
    .values({
      slug,
      title: args.title ?? null,
      presetSlug: args.presetSlug,
      sourceImages: args.sourceImages,
      presetSlugs: args.presetSlugs,
      expectedOutputCount: args.expectedOutputCount,
      notes: args.notes,
      createdBy: args.createdBy,
      status: "queued",
    })
    .returning();
  return row;
}

export async function listIgPreviews(limit = 25): Promise<IgPreview[]> {
  return db
    .select()
    .from(schema.igPreviews)
    .orderBy(desc(schema.igPreviews.createdAt))
    .limit(limit);
}

export async function getIgPreviewBySlug(
  slug: string,
): Promise<IgPreview | null> {
  const rows = await db
    .select()
    .from(schema.igPreviews)
    .where(eq(schema.igPreviews.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function countIgPreviews(): Promise<number> {
  const rows = await db.select().from(schema.igPreviews);
  return rows.length;
}

export async function deleteIgPreview(id: string): Promise<boolean> {
  const rows = await db
    .delete(schema.igPreviews)
    .where(eq(schema.igPreviews.id, id))
    .returning({ id: schema.igPreviews.id });
  return rows.length > 0;
}

export async function getIgPreviewById(id: string): Promise<IgPreview | null> {
  const rows = await db
    .select()
    .from(schema.igPreviews)
    .where(eq(schema.igPreviews.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function appendIgPreviewOutput(
  id: string,
  output: IgPreviewOutput,
): Promise<void> {
  await db
    .update(schema.igPreviews)
    .set({
      outputs: sql`${schema.igPreviews.outputs} || ${JSON.stringify([output])}::jsonb`,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.igPreviews.id, id));
}

export async function setIgPreviewStatus(
  id: string,
  status: IgPreviewStatus,
  opts: { completed?: boolean } = {},
): Promise<void> {
  await db
    .update(schema.igPreviews)
    .set({
      status,
      updatedAt: sql`now()`,
      ...(opts.completed ? { completedAt: sql`now()` } : {}),
    })
    .where(eq(schema.igPreviews.id, id));
}

export async function removeIgPreviewOutputs(
  id: string,
  indexes: number[],
): Promise<IgPreview | null> {
  const row = await getIgPreviewById(id);
  if (!row) return null;
  const drop = new Set(indexes);
  const next = row.outputs.filter((_, i) => !drop.has(i));
  await db
    .update(schema.igPreviews)
    .set({
      outputs: next,
      status: "queued",
      completedAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.igPreviews.id, id));
  return getIgPreviewById(id);
}

export async function bumpIgPreviewExpected(
  id: string,
  delta: number,
): Promise<void> {
  await db
    .update(schema.igPreviews)
    .set({
      expectedOutputCount: sql`${schema.igPreviews.expectedOutputCount} + ${delta}`,
      status: "queued",
      completedAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.igPreviews.id, id));
}

export async function resetIgPreviewOutputs(id: string): Promise<void> {
  await db
    .update(schema.igPreviews)
    .set({
      outputs: sql`'[]'::jsonb`,
      status: "queued",
      completedAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.igPreviews.id, id));
}
