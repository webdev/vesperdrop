import { NextResponse } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { getPreviewById, resetFailedSlots } from "@/lib/etsy-outreach/pages";
import { processEtsyPreview } from "@/lib/workflows/process-etsy-preview";

const Body = z.object({
  pageId: z.string().uuid(),
  mock: z.boolean().default(false),
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
  const { pageId, mock } = parsed.data;

  const page = await getPreviewById(pageId);
  if (!page) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await resetFailedSlots(pageId);
  await start(processEtsyPreview, [pageId, mock]);

  return NextResponse.json({ ok: true });
}
