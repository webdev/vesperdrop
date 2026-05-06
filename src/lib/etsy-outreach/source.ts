import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_RELATIVE = "data/etsy-candidates.md";

export function candidatesFilePath(): string {
  const fromEnv = process.env.ETSY_CANDIDATES_PATH;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return path.join(process.cwd(), DEFAULT_RELATIVE);
}

export async function readCandidatesMd(): Promise<string> {
  return readFile(candidatesFilePath(), "utf8");
}
