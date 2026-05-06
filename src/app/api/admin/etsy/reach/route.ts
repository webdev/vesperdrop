import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql as sqlExpr } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { db, schema } from "@/lib/db";

const Body = z.object({
  candidateId: z.string().uuid(),
  on: z.boolean(),
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

  const { candidateId, on } = parsed.data;
  await db
    .update(schema.etsyCandidates)
    .set({
      reachedOutAt: on ? sqlExpr`now()` : null,
      updatedAt: sqlExpr`now()`,
    })
    .where(eq(schema.etsyCandidates.id, candidateId));

  return NextResponse.json({ ok: true, on });
}
