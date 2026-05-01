import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRunForUser } from "@/lib/db/runs";
import { listGenerationsForRun } from "@/lib/db/generations";
import { listPacksForRun } from "@/lib/db/packs";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const run = await getRunForUser(id, user.id);
    const generations = await listGenerationsForRun(id, user.id);
    const packs = await listPacksForRun(id, user.id);
    return NextResponse.json({ run, generations, packs });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
