import "server-only";
import crypto from "node:crypto";

export function generatePreviewToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
