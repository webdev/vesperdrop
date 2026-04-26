import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Scene = {
  slug: string;
  name: string;
  mood: string;
  category: string;
  palette: string[];
  imageUrl: string;
};

export async function listScenes(): Promise<Scene[]> {
  const { data, error } = await supabaseAdmin
    .from("scenes")
    .select("slug, name, mood, category, palette, image_url")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    mood: r.mood,
    category: r.category,
    palette: r.palette,
    imageUrl: r.image_url,
  }));
}
