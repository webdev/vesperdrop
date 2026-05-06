import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { setCandidatesStatus } from "@/lib/etsy-outreach/candidates";

const Body = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await setCandidatesStatus(parsed.data.candidateIds, "skipped");
  return NextResponse.json({ ok: true });
}
