import { NextResponse } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  getIgPreviewById,
  removeIgPreviewOutputs,
} from "@/lib/ig-previews/pages";
import { planGeneration } from "@/lib/ig-previews/presets";
import {
  pickPresetForSlot,
  type IgSlotType,
} from "@/lib/ig-previews/slot-types";
import { processIgPreview } from "@/lib/workflows/process-ig-preview";

export const runtime = "nodejs";

const Params = z.object({ id: z.string().uuid() });
const Body = z.object({
  indexes: z.array(z.number().int().nonnegative()).min(1).max(64),
  mock: z.boolean().optional(),
});

const VALID_SLOTS: IgSlotType[] = [
  "lifestyle_hero",
  "storefront",
  "detail",
];

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
  const { indexes, mock } = parsedBody.data;

  const row = await getIgPreviewById(id);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const valid = indexes.filter((i) => i < row.outputs.length);
  if (valid.length === 0) {
    return NextResponse.json(
      { error: "no valid output indexes" },
      { status: 400 },
    );
  }

  const derived = planGeneration(row.sourceImages.length).outputs;
  const remainingUsed = new Set<string>(
    row.outputs
      .filter((_, i) => !valid.includes(i))
      .map((o) => o.presetSlug)
      .filter(Boolean),
  );

  const preferredSlots: Array<{
    sourceIndex: number;
    slotType: IgSlotType;
    presetSlug: string;
  }> = [];
  for (const i of valid) {
    const old = row.outputs[i];
    const slotType: IgSlotType =
      old.slotType && VALID_SLOTS.includes(old.slotType)
        ? old.slotType
        : (derived[i]?.slotType ?? "lifestyle_hero");
    const fresh = await pickPresetForSlot(slotType, remainingUsed);
    remainingUsed.add(fresh);
    preferredSlots.push({
      sourceIndex: old.sourceIndex,
      slotType,
      presetSlug: fresh,
    });
  }

  await removeIgPreviewOutputs(id, valid);
  void start(processIgPreview, [id, Boolean(mock), preferredSlots]).catch((e) =>
    console.error("[ig-preview] regenerate enqueue failed", e),
  );

  return NextResponse.json({
    ok: true,
    removed: valid.length,
    mock: Boolean(mock),
  });
}
