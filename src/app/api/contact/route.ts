import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { postContactToSlack } from "@/lib/contact/slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PayloadSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  company: z.string().min(1).max(160),
  monthlyVolume: z.enum(["<500", "500-1500", "1500-5000", "5000+"]),
  message: z.string().max(2000).nullable().optional(),
  source: z.string().max(64).default("contact-direct"),
  // Honeypot. Real clients leave it empty. Bots fill it. Accept anything so
  // we can detect a non-empty value below and return ok silently — failing
  // the schema would leak that the field is a trap.
  website: z.string().max(2000).optional(),
});

// The shared try_take_token RPC keys on uuid user_id, so for an unauthenticated
// public form we run a tiny in-memory limiter scoped to this route instead of
// shipping a new migration. 3 submissions per IP per hour.
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 3;
const ipHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= LIMIT) {
    ipHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipHits.set(ip, recent);
  return false;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // Honeypot trip. Return ok so the bot doesn't retry.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    await postContactToSlack({
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company,
      monthlyVolume: parsed.data.monthlyVolume,
      message: parsed.data.message ?? null,
      source: parsed.data.source ?? "contact-direct",
    });
  } catch (err) {
    console.error("[contact] slack post failed", err);
    return NextResponse.json({ error: "delivery_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
