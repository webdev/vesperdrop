import "server-only";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "@/lib/env";

export async function storeWatermarked(
  buffer: Buffer,
  key: string,
  origin: string,
  contentType = "image/png",
): Promise<string> {
  if (env.BLOB_READ_WRITE_TOKEN) {
    const result = await put(`watermarked/${key}`, buffer, { access: "public", contentType });
    return result.url;
  }
  const dir = path.join(process.cwd(), "public", "watermarked");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), buffer);
  return `${origin}/watermarked/${key}`;
}

// Public store for the raw (un-watermarked) preview, written alongside the
// watermarked version so /try/claim can copy the raw bytes into private
// storage. Anonymous /try display still uses the watermarked URL.
export async function storeRawPreview(
  buffer: Buffer,
  key: string,
  origin: string,
  contentType = "image/png",
): Promise<string> {
  if (env.BLOB_READ_WRITE_TOKEN) {
    const result = await put(`raw-preview/${key}`, buffer, { access: "public", contentType });
    return result.url;
  }
  const dir = path.join(process.cwd(), "public", "raw-preview");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), buffer);
  return `${origin}/raw-preview/${key}`;
}

// Stores at a path with a high-entropy random token. The returned URL must
// never be exposed to the client — fetched server-side via the auth proxy.
export async function storePrivate(
  buffer: Buffer,
  prefix: string,
  contentType = "image/png",
): Promise<string> {
  const token = crypto.randomBytes(24).toString("base64url");
  if (env.BLOB_READ_WRITE_TOKEN) {
    const result = await put(`${prefix}/${token}.png`, buffer, {
      access: "public",
      contentType,
    });
    return result.url;
  }
  const dir = path.join(process.cwd(), ".private-blob", prefix);
  await mkdir(dir, { recursive: true });
  const filename = `${token}.png`;
  await writeFile(path.join(dir, filename), buffer);
  return `__local__/${prefix}/${filename}`;
}

export async function copyToPrivate(
  sourceUrl: string,
  prefix: string,
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`copy failed: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return storePrivate(buf, prefix, contentType);
}

export function isLocalPrivate(stored: string): boolean {
  return stored.startsWith("__local__/");
}

export function localPrivatePath(stored: string): string {
  return path.join(
    process.cwd(),
    ".private-blob",
    stored.slice("__local__/".length),
  );
}
