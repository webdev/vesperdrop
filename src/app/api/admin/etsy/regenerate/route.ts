import { NextResponse } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  getPreviewById,
  resetAllSlots,
  resetSlots,
} from "@/lib/etsy-outreach/pages";
import { setCandidateStatus } from "@/lib/etsy-outreach/candidates";
import { processEtsyPreview } from "@/lib/workflows/process-etsy-preview";

const Body = z.object({
  pageId: z.string().uuid(),
  mock: z.boolean().default(false),
  // Optional. If provided, only the listed slots are reset and
  // regenerated; other slots keep their existing images. Omitting the
  // field resets all three slots (full regenerate).
  slots: z
    .array(z.enum(["hero", "lifestyle", "detail"]))
    .min(1)
    .optional(),
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
  const { pageId, mock, slots } = parsed.data;

  const page = await getPreviewById(pageId);
  if (!page) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (slots && slots.length > 0) {
    await resetSlots(pageId, slots);
  } else {
    await resetAllSlots(pageId);
  }
  await setCandidateStatus(page.candidateId, "generating");
  await start(processEtsyPreview, [pageId, mock]);

  return NextResponse.json({ ok: true, slots: slots ?? "all" });
}
