import "server-only";
import { put } from "@vercel/blob";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import crypto from "node:crypto";
import { env } from "@/lib/env";

export async function snapshotEtsyImage(
  sourceUrl: string,
  pageId: string,
): Promise<string> {
  const res = await fetch(sourceUrl, {
    headers: { "user-agent": "Vesperdrop/1.0 (+https://vesperdrop.com)" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`snapshot ${res.status} for ${sourceUrl}`);
  }
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = contentType.includes("png") ? "png" : "jpg";
  const key = `etsy-source/${pageId}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

  if (env.BLOB_READ_WRITE_TOKEN) {
    const result = await put(key, buf, { access: "public", contentType });
    return result.url;
  }
  // Local dev fallback.
  const dir = path.join(process.cwd(), "public", "etsy-source");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, path.basename(key));
  await writeFile(file, buf);
  return `/etsy-source/${path.basename(key)}`;
}
