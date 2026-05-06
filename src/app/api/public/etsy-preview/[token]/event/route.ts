import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getPreviewByToken } from "@/lib/etsy-outreach/pages";
import { recordEvent } from "@/lib/etsy-outreach/events";

const Body = z.object({
  kind: z.enum(["view", "cta_click", "signup_start"]),
  label: z.string().max(64).optional(),
});

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

const VIEW_COOKIE_PREFIX = "vd_etsy_view_";

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

  const cookieStore = await cookies();

  // Persist 30-day attribution cookie on every event so any path through
  // the page (view, cta, signup_start) keeps the seller attributable
  // through the downstream Stripe webhook.
  cookieStore.set(
    "vd_etsy_ref",
    JSON.stringify({ token, candidate_id: page.candidateId }),
    { httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" },
  );

  // Views are deduped per session via a short-lived cookie; CTA and
  // signup_start always record.
  if (parsed.data.kind === "view") {
    const cookieName = `${VIEW_COOKIE_PREFIX}${page.id.slice(0, 8)}`;
    if (cookieStore.get(cookieName)?.value === "1") {
      return NextResponse.json({ ok: true, deduped: true });
    }
    cookieStore.set(cookieName, "1", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });
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
