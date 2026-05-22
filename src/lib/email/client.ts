import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

let _client: Resend | null = null;

/**
 * Returns a cached Resend client, or null if RESEND_API_KEY is not set.
 * Callers should null-check and respond 503 so dev/preview without keys
 * doesn't crash the route — see /api/try/email-photo.
 */
export function getResendClient(): Resend | null {
  if (_client) return _client;
  const key = env.RESEND_API_KEY;
  if (!key) return null;
  _client = new Resend(key);
  return _client;
}
