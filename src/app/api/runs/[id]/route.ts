import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getRunForUser,
  renameRunForUser,
  RUN_NAME_MAX_LENGTH,
} from "@/lib/db/runs";
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

const PatchBody = z.object({
  name: z
    .string()
    .max(RUN_NAME_MAX_LENGTH, `name must be ≤ ${RUN_NAME_MAX_LENGTH} characters`)
    .nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid body" },
      { status: 400 },
    );
  }

  try {
    const ok = await renameRunForUser(id, user.id, parsed.data.name);
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 },
    );
  }
}
