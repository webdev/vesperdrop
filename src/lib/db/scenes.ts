import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "./index";
import { scenes } from "./schema";

export type Scene = {
  slug: string;
  name: string;
  mood: string;
  category: string;
  palette: string[];
  imageUrl: string;
};

export async function listScenes(): Promise<Scene[]> {
  const rows = await db
    .select({
      slug: scenes.slug,
      name: scenes.name,
      mood: scenes.mood,
      category: scenes.category,
      palette: scenes.palette,
      imageUrl: scenes.imageUrl,
    })
    .from(scenes)
    .orderBy(asc(scenes.displayOrder));
  return rows;
}

export async function getSceneBySlug(slug: string): Promise<Scene | null> {
  const [row] = await db
    .select({
      slug: scenes.slug,
      name: scenes.name,
      mood: scenes.mood,
      category: scenes.category,
      palette: scenes.palette,
      imageUrl: scenes.imageUrl,
    })
    .from(scenes)
    .where(eq(scenes.slug, slug))
    .limit(1);
  return row ?? null;
}
