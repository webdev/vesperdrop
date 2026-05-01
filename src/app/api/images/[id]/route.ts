import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { isLocalPrivate, localPrivatePath } from "@/lib/storage";

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
  } else {
    const fetched = await fetch(stored);
    if (!fetched.ok || !fetched.body) {
      return NextResponse.json({ error: "fetch failed" }, { status: 502 });
    }
    body = fetched.body;
    contentType = fetched.headers.get("content-type") ?? contentType;
    contentLength = fetched.headers.get("content-length");
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
