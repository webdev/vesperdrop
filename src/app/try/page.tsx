import type { Metadata } from "next";
import { listScenes } from "@/lib/db/scenes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstNameFrom } from "@/lib/user-display";
import { TryFlow } from "./try-flow";

export const metadata: Metadata = {
  title: "Try Vesperdrop — develop a sample batch",
  description:
    "Drop a product photo, pick a style, and watch Vesperdrop develop a 6-image lifestyle batch — no account, no card.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const [scenes, supabase] = await Promise.all([
    listScenes(),
    createSupabaseServerClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <TryFlow scenes={scenes} firstName={user ? firstNameFrom(user) : null} />;
}
