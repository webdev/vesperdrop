import type { Metadata } from "next";
import { sceneify } from "@/lib/sceneify/client";
import type { Scene } from "@/lib/db/scenes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstNameFrom } from "@/lib/user-display";
import { isAdminEmail } from "@/lib/admin";
import { TryFlow } from "./try-flow";

export const metadata: Metadata = {
  title: "Try free — develop a sample batch",
  description:
    "Drop a product photo, pick a scene, and watch Verceldrop develop a 6-image lifestyle batch — no account, no card.",
  alternates: { canonical: "/try" },
  openGraph: {
    title: "Try Verceldrop free — develop a sample batch",
    description:
      "Drop a product photo, pick a scene, and watch Verceldrop develop a 6-image lifestyle batch — no account, no card.",
    url: "/try",
    type: "website",
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
  }));
  return (
    <TryFlow
      scenes={scenes}
      firstName={user ? firstNameFrom(user) : null}
      isAdmin={isAdminEmail(user?.email ?? null)}
    />
  );
}
