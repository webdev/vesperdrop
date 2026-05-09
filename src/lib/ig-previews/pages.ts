import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { IgPreview } from "@/lib/db/schema";
import { generatePreviewSlug } from "./slug";

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
