import { NextResponse } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  getIgPreviewById,
  resetIgPreviewOutputs,
} from "@/lib/ig-previews/pages";
import { processIgPreview } from "@/lib/workflows/process-ig-preview";

export const runtime = "nodejs";

const Params = z.object({ id: z.string().uuid() });
const Body = z.object({ mock: z.boolean().optional() });

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
    // empty body is fine
  }
  const parsedBody = Body.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { id } = parsedParams.data;
  const mock = Boolean(parsedBody.data.mock);

  const row = await getIgPreviewById(id);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (row.status === "completed") {
    return NextResponse.json(
      { error: "already completed" },
      { status: 409 },
    );
  }

  await resetIgPreviewOutputs(id);
  void start(processIgPreview, [id, mock]).catch((e) =>
    console.error("[ig-preview] retry enqueue failed", e),
  );

  return NextResponse.json({ ok: true, mock });
}
