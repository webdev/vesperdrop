import "server-only";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
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
