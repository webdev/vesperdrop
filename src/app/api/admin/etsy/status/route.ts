import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { getPreviewById } from "@/lib/etsy-outreach/pages";

const Query = z.object({ pageId: z.string().uuid() });

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({ pageId: url.searchParams.get("pageId") });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const page = await getPreviewById(parsed.data.pageId);
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: page.id,
    status: page.status,
    heroStatus: page.heroStatus,
    lifestyleStatus: page.lifestyleStatus,
    detailStatus: page.detailStatus,
    completedAt: page.completedAt,
  });
}
