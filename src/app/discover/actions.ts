"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PICKS_COOKIE = "vd_picks";
const MAX_AGE_SECONDS = 60 * 5; // 5 minutes — survives auth round-trips

export async function applyPicks(slugs: string[]) {
  const clean = slugs
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]+$/.test(s));
  if (clean.length === 0) redirect("/try");

  const store = await cookies();
  store.set(PICKS_COOKIE, clean.join(","), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  // Signed-in users go to the Styles workspace; anonymous users start the
  // free try-flow with their picks pre-selected.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/app" : "/try");
}
