import { NextResponse } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  bumpIgPreviewExpected,
  getIgPreviewById,
} from "@/lib/ig-previews/pages";
import {
  IG_SLOT_PRIORITY,
  pickPresetForSlot,
  type IgSlotType,
} from "@/lib/ig-previews/slot-types";
import { processIgPreview } from "@/lib/workflows/process-ig-preview";

export const runtime = "nodejs";

const Params = z.object({ id: z.string().uuid() });
const Body = z.object({
  sourceIndex: z.number().int().nonnegative(),
  count: z.number().int().min(1).max(4).default(1),
  mock: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsedParams = Params.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsedBody = Body.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "invalid body" },
      { status: 400 },
    );
  }

  const { id } = parsedParams.data;
  const { sourceIndex, count, mock } = parsedBody.data;

  const row = await getIgPreviewById(id);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (sourceIndex >= row.sourceImages.length) {
    return NextResponse.json(
      { error: "sourceIndex out of range" },
      { status: 400 },
    );
  }

  const presentSlots = new Set<IgSlotType>();
  for (const o of row.outputs) {
    if (o.sourceIndex !== sourceIndex) continue;
    if (o.slotType) presentSlots.add(o.slotType);
  }
  const missing = IG_SLOT_PRIORITY.filter((s) => !presentSlots.has(s));

  if (missing.length === 0) {
    return NextResponse.json(
      { error: "max 3 per reference" },
      { status: 400 },
    );
  }

  const usedSlugs = new Set<string>(
    row.outputs.map((o) => o.presetSlug).filter(Boolean),
  );

  const want = Math.min(count, missing.length);
  const preferredSlots: Array<{
    sourceIndex: number;
    slotType: IgSlotType;
    presetSlug: string;
  }> = [];
  for (let i = 0; i < want; i += 1) {
    const slotType = missing[i];
    const presetSlug = await pickPresetForSlot(slotType, usedSlugs);
    usedSlugs.add(presetSlug);
    preferredSlots.push({ sourceIndex, slotType, presetSlug });
  }

  await bumpIgPreviewExpected(id, want);
  void start(processIgPreview, [id, Boolean(mock), preferredSlots]).catch((e) =>
    console.error("[ig-preview] add-source enqueue failed", e),
  );

  return NextResponse.json({
    ok: true,
    added: want,
    slotTypes: preferredSlots.map((p) => p.slotType),
    mock: Boolean(mock),
  });
}
