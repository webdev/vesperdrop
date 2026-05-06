import { NextResponse } from "next/server";
import { z } from "zod";
import { getPreviewByToken } from "@/lib/etsy-outreach/pages";
import { recordEvent } from "@/lib/etsy-outreach/events";

const Body = z.object({
  kind: z.enum(["cta_click", "signup_start"]),
  label: z.string().max(64).optional(),
});

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const page = await getPreviewByToken(token);
  if (!page) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await recordEvent({
    pageId: page.id,
    kind: parsed.data.kind,
    label: parsed.data.label,
    userAgent: req.headers.get("user-agent"),
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
