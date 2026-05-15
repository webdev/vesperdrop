import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { isLocalPrivate, localPrivatePath } from "@/lib/storage";
import { applyWatermark } from "@/lib/watermark";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [gen] = await db
    .select()
    .from(generations)
    .where(eq(generations.id, id))
    .limit(1);

  if (!gen) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (gen.userId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") === "source" ? "source" : "output";
  const wantDownload = url.searchParams.get("download") === "1";

  const stored =
    type === "source" ? gen.sceneifySourceId : gen.outputUrl;
  if (!stored) {
    return NextResponse.json({ error: "no image" }, { status: 404 });
  }

  // Entitlement gate. Two ways to bypass the free-plan paywall:
  //   1. plan !== "free" (Pro / Starter / Studio / Agency)
  //   2. user is on the admin allowlist — admins get every paid
  //      feature regardless of their profiles.plan column. See
  //      CLAUDE.md → Admin entitlement.
  // We resolve entitlement once and reuse it for both the download
  // block and the watermark policy below.
  const isAdmin = isAdminEmail(user.email ?? null);
  let plan: string = "free";
  if (!isAdmin) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    plan = (profile?.plan as string | undefined) ?? "free";
  }
  const entitled = isAdmin || plan !== "free";

  // Free plan can preview but not download. Paid + admins get the
  // file with content-disposition: attachment. Source-type requests
  // are exempt — the user owns their own upload.
  if (wantDownload && type === "output" && !entitled) {
    return NextResponse.json(
      { error: "downloads_require_upgrade" },
      { status: 402 },
    );
  }

  // Watermark policy is plan-driven at serve time. The `watermarked` flag
  // on the row records "this gen was created under a watermarking plan",
  // but whether we ACTUALLY apply the watermark depends on the user's
  // CURRENT entitlement: only un-entitled free users see watermarks.
  // The moment Stripe upgrades them (or they hit the admin allowlist),
  // the next image request renders clean — no backfill needed.
  const shouldWatermark = type === "output" && gen.watermarked === true && !entitled;

  let body: ReadableStream<Uint8Array> | Buffer | null = null;
  let contentType = "image/png";
  let contentLength: string | null = null;

  if (isLocalPrivate(stored)) {
    try {
      const buf = await readFile(localPrivatePath(stored));
      body = buf;
      contentLength = buf.byteLength.toString();
    } catch {
      return NextResponse.json({ error: "fetch failed" }, { status: 502 });
    }
  } else if (shouldWatermark) {
    const fetched = await fetch(stored);
    if (!fetched.ok) {
      return NextResponse.json({ error: "fetch failed" }, { status: 502 });
    }
    const raw = Buffer.from(await fetched.arrayBuffer());
    body = raw;
    contentType = fetched.headers.get("content-type") ?? contentType;
    contentLength = raw.byteLength.toString();
  } else {
    const fetched = await fetch(stored);
    if (!fetched.ok || !fetched.body) {
      return NextResponse.json({ error: "fetch failed" }, { status: 502 });
    }
    body = fetched.body;
    contentType = fetched.headers.get("content-type") ?? contentType;
    contentLength = fetched.headers.get("content-length");
  }

  if (shouldWatermark && body && Buffer.isBuffer(body)) {
    const watermarked = await applyWatermark(body, "VESPERDROP PREVIEW");
    body = watermarked;
    contentType = "image/png";
    contentLength = watermarked.byteLength.toString();
  }

  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("cache-control", "private, max-age=300");
  if (contentLength) headers.set("content-length", contentLength);
  if (wantDownload) {
    const filename = `${type}-${id}.png`;
    headers.set("content-disposition", `attachment; filename="${filename}"`);
  }

  return new Response(body as BodyInit, { status: 200, headers });
}
