import "server-only";
import { db, schema } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashIp } from "@/lib/etsy-outreach/events";
import type { IgPreviewEvent } from "@/lib/db/schema";

export type IgPreviewEventKind = IgPreviewEvent["kind"];

export async function recordIgPreviewEvent(args: {
  previewId: string;
  kind: IgPreviewEventKind;
  label?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<void> {
  await db.insert(schema.igPreviewEvents).values({
    previewId: args.previewId,
    kind: args.kind,
    label: args.label ?? null,
    userAgent: args.userAgent?.slice(0, 500) ?? null,
    ipHash: args.ip ? hashIp(args.ip) : null,
  });

  const { error } = await supabaseAdmin.rpc("increment_ig_preview_counter", {
    p_preview_id: args.previewId,
    p_kind: args.kind,
  });
  if (error) {
    console.error("[ig-previews] counter RPC failed", error);
  }
}
