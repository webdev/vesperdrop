"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const PICKS_COOKIE = "vd_picks";
const MAX_AGE_SECONDS = 30;

export async function applyPicks(slugs: string[]) {
  const clean = slugs
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]+$/.test(s));
  if (clean.length === 0) redirect("/app");

  const store = await cookies();
  store.set(PICKS_COOKIE, clean.join(","), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  redirect("/app");
}
