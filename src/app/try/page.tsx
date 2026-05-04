import type { Metadata } from "next";
import { sceneify } from "@/lib/sceneify/client";
import type { Scene } from "@/lib/db/scenes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { Nav } from "@/components/nav";
import { TryFlow } from "./try-flow";

const TRY_TITLE = "Try free — 1 HD lifestyle shot, no card";
const TRY_DESCRIPTION =
  "Drop a product photo, pick a scene, and watch Vesperdrop develop a 6-image lifestyle batch — no account, no card.";

export const metadata: Metadata = {
  title: { absolute: `${TRY_TITLE} · Vesperdrop` },
  description: TRY_DESCRIPTION,
  alternates: { canonical: "/try" },
  openGraph: {
    title: TRY_TITLE,
    description: TRY_DESCRIPTION,
    url: "/try",
    type: "website",
  },
  twitter: {
    title: TRY_TITLE,
    description: TRY_DESCRIPTION,
  },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const [presets, supabase] = await Promise.all([
    sceneify().listPublicPresets(),
    createSupabaseServerClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const scenes: Scene[] = presets.map((p) => ({
    slug: p.slug,
    name: p.name,
    mood: p.description,
    category: p.category,
    palette: p.palette,
    imageUrl: p.heroImageUrl,
    isPro: p.isPro,
  }));
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Nav />
      <div className="flex-1">
        <TryFlow
          scenes={scenes}
          isAdmin={isAdminEmail(user?.email ?? null)}
          isAuthed={!!user}
        />
      </div>
    </div>
  );
}
