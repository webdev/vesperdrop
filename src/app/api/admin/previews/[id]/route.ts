import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { deleteIgPreview } from "@/lib/ig-previews/pages";

export const runtime = "nodejs";

const Params = z.object({ id: z.string().uuid() });

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = Params.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const deleted = await deleteIgPreview(parsed.data.id);
  if (!deleted) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
