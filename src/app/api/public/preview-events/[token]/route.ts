import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { recordEvent } from "@/lib/etsy-outreach/events";
import { recordIgPreviewEvent } from "@/lib/ig-previews/events";

const Body = z.object({
  kind: z.enum(["view", "cta_click", "signup_start"]),
  label: z.string().max(64).optional(),
});

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

const VIEW_COOKIE_PREFIX = "vd_preview_view_";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const etsy = await db
    .select()
    .from(schema.etsyPreviewPages)
    .where(eq(schema.etsyPreviewPages.token, token))
    .limit(1);
  const etsyRow = etsy[0];

  let igRow: typeof schema.igPreviews.$inferSelect | undefined;
  if (!etsyRow) {
    const ig = await db
      .select()
      .from(schema.igPreviews)
      .where(eq(schema.igPreviews.slug, token))
      .limit(1);
    igRow = ig[0];
  }

  if (!etsyRow && !igRow) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const cookieStore = await cookies();
  const previewId = etsyRow ? etsyRow.id : igRow!.id;
  const sourceType = etsyRow ? "etsy_preview" : "ig_leadgen";

  cookieStore.set(
    "vd_preview_ref",
    JSON.stringify({
      token,
      preview_id: previewId,
      source_type: sourceType,
      candidate_id: etsyRow?.candidateId ?? null,
    }),
    { httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" },
  );

  if (parsed.data.kind === "view") {
    const cookieName = `${VIEW_COOKIE_PREFIX}${previewId.slice(0, 8)}`;
    if (cookieStore.get(cookieName)?.value === "1") {
      return NextResponse.json({ ok: true, deduped: true });
    }
    cookieStore.set(cookieName, "1", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });
  }

  const userAgent = req.headers.get("user-agent");
  const ip = clientIp(req);

  if (etsyRow) {
    await recordEvent({
      pageId: etsyRow.id,
      kind: parsed.data.kind,
      label: parsed.data.label,
      userAgent,
      ip,
    });
  } else {
    await recordIgPreviewEvent({
      previewId: igRow!.id,
      kind: parsed.data.kind,
      label: parsed.data.label,
      userAgent,
      ip,
    });
  }

  return NextResponse.json({ ok: true });
}
