import "server-only";
import { sql, eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import crypto from "node:crypto";
import type { EtsyPreviewEvent } from "@/lib/db/schema";

export type EtsyEventKind = EtsyPreviewEvent["kind"];

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "vesperdrop-default-salt";
  return crypto.createHash("sha256").update(salt).update(ip).digest("hex").slice(0, 32);
}

export async function recordEvent(args: {
  pageId: string;
  kind: EtsyEventKind;
  label?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<void> {
  await db.insert(schema.etsyPreviewEvents).values({
    pageId: args.pageId,
    kind: args.kind,
    label: args.label ?? null,
    userAgent: args.userAgent?.slice(0, 500) ?? null,
    ipHash: args.ip ? hashIp(args.ip) : null,
  });

  // Atomic counter via RPC.
  const { error } = await supabaseAdmin.rpc("increment_etsy_preview_counter", {
    p_page_id: args.pageId,
    p_kind: args.kind,
  });
  if (error) {
    console.error("[etsy-outreach] counter RPC failed", error);
  }
}

export async function topPreviewsByViews(
  limit = 5,
): Promise<Array<{
  id: string;
  token: string;
  title: string;
  viewCount: number;
  ctaClickCount: number;
  signupCount: number;
}>> {
  const rows = await db
    .select({
      id: schema.etsyPreviewPages.id,
      token: schema.etsyPreviewPages.token,
      listingSnapshot: schema.etsyPreviewPages.listingSnapshot,
      viewCount: schema.etsyPreviewPages.viewCount,
      ctaClickCount: schema.etsyPreviewPages.ctaClickCount,
      signupCount: schema.etsyPreviewPages.signupCount,
    })
    .from(schema.etsyPreviewPages)
    .orderBy(desc(schema.etsyPreviewPages.viewCount))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    title: r.listingSnapshot.title,
    viewCount: r.viewCount,
    ctaClickCount: r.ctaClickCount,
    signupCount: r.signupCount,
  }));
}

export async function previewMetrics(): Promise<{
  previewCount: number;
  viewSum: number;
  ctaClickSum: number;
  signupSum: number;
}> {
  const [row] = await db
    .select({
      previewCount: sql<number>`count(*)::int`,
      viewSum: sql<number>`coalesce(sum(${schema.etsyPreviewPages.viewCount}),0)::int`,
      ctaClickSum: sql<number>`coalesce(sum(${schema.etsyPreviewPages.ctaClickCount}),0)::int`,
      signupSum: sql<number>`coalesce(sum(${schema.etsyPreviewPages.signupCount}),0)::int`,
    })
    .from(schema.etsyPreviewPages);
  return row;
}
