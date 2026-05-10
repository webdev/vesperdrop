import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tryIntents } from "@/lib/db/schema";

// Persist a "Try free" intent server-side at the moment the user submits the
// sign-up form, so they can confirm their email on a different device and
// still land back in the studio with their photo + scenes ready.
//
// This route is intentionally unauthenticated: signUp returns no session
// when Supabase email confirmation is enabled, so we have no auth.getUser()
// to gate against. Mitigations: rate-limit by IP, validate every field,
// cap payload, store nothing more sensitive than a public Vercel Blob URL
// + scene slugs (no PII beyond the email the user just typed). Worst case:
// a noisy IP fills the table with rows for arbitrary emails — bounded by
// the rate limit, GC'd from the table by a future cron based on
// consumed_at / created_at.

export const runtime = "nodejs";

const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || b.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_LIMIT) return false;
  b.count += 1;
  return true;
}

const HttpUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), "must be http(s) url");

const SaveIntentSchema = z.object({
  email: z.string().email().max(254),
  sourceUrl: HttpUrl,
  sourceName: z.string().min(1).max(200),
  sourceMimeType: z.string().min(1).max(100),
  pickedScenes: z.array(z.string().min(1).max(100)).min(1).max(10),
});

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (!rateLimitOk(ip)) {
    return NextResponse.json(
      { error: "Too many save-intent calls. Wait a minute and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = SaveIntentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { email, sourceUrl, sourceName, sourceMimeType, pickedScenes } =
    parsed.data;

  // Insert is preferred over upsert: a returning user who started a fresh
  // batch on a different device shouldn't lose their original pending row.
  // The consume-intent route picks the latest unconsumed row and marks it
  // consumed; older rows GC out of the table on a schedule.
  await db.insert(tryIntents).values({
    email: email.toLowerCase(),
    sourceUrl,
    sourceName,
    sourceMimeType,
    pickedScenes,
  });

  return NextResponse.json({ ok: true });
}
