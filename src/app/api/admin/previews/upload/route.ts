import { put } from "@vercel/blob";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 12;

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "no files" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `at most ${MAX_FILES} files per request` },
      { status: 400 },
    );
  }

  const origin = new URL(req.url).origin;
  const uploaded: Array<{ url: string; name: string; mimeType: string }> = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: `${file.name}: expected an image` },
        { status: 400 },
      );
    }
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      return NextResponse.json(
        { error: `${file.name}: only JPG or PNG` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `${file.name}: image too large (max 10MB)` },
        { status: 400 },
      );
    }

    const key = `ig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    let url: string;
    if (env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`ig-previews/${key}`, bytes, {
        access: "public",
        contentType: file.type,
      });
      url = blob.url;
    } else {
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const filename = `${key}-${safe}`;
      await writeFile(path.join(dir, filename), bytes);
      url = `${origin}/uploads/${filename}`;
    }
    uploaded.push({ url, name: file.name, mimeType: file.type });
  }

  return NextResponse.json({ files: uploaded });
}
