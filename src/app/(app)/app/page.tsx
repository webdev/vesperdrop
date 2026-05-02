import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Scene } from "@/lib/db/scenes";
import { sceneify } from "@/lib/sceneify/client";
import { RunForm } from "@/components/app/run-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCreditsBalance } from "@/lib/db/credits";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ presets?: string; scenes?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/app");

  const { presets: presetsParam, scenes: scenesParam } = await searchParams;
  const cookiePicks = (await cookies()).get("vd_picks")?.value;
  const initialSelected =
    (cookiePicks ?? presetsParam ?? scenesParam)
      ?.split(",")
      .filter(Boolean) ?? [];

  const [presets, credits] = await Promise.all([
    sceneify().listPublicPresets(),
    getCreditsBalance(user.id),
  ]);

  const scenes: Scene[] = presets.map((p) => ({
    slug: p.slug,
    name: p.name,
    mood: p.mood,
    category: p.category,
    palette: p.palette,
    imageUrl: p.heroImageUrl,
  }));

  return (
    <RunForm
      scenes={scenes}
      initialSceneIds={initialSelected}
      credits={credits ?? 0}
    />
  );
}
