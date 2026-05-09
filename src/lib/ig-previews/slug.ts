import "server-only";
import crypto from "node:crypto";

export function generatePreviewSlug(): string {
  return crypto.randomBytes(16).toString("base64url");
}
