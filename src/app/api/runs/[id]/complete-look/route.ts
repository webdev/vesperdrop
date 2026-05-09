import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { tryDeductCredits, addCredits } from "@/lib/db/credits";
import {
  createPackWithShots,
  findExistingPack,
  listPackShots,
} from "@/lib/db/packs";
import { completeLookViaSceneify } from "@/lib/ai/sceneify";
import { isPackPlatform, packCreditCost, LISTING_PACK_META } from "@/lib/ai/listing-packs";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  parentGenerationId: z.string().uuid(),
  platform: z.enum(["amazon", "shopify", "instagram", "tiktok"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Admin allowlist bypasses credit deduction entirely (see lib/admin.ts).
  const isAdmin = isAdminEmail(user.email ?? null);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { parentGenerationId, platform } = parsed.data;
  if (!isPackPlatform(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }

  // Validate parent generation belongs to user, is HD, has a sceneify generation id.
  const [parent] = await db
    .select()
    .from(generations)
    .where(
      and(
        eq(generations.id, parentGenerationId),
        eq(generations.userId, user.id),
        eq(generations.runId, runId),
      ),
    );
  if (!parent) {
    return NextResponse.json({ error: "parent generation not found" }, { status: 404 });
  }
  if (parent.status !== "succeeded" || !parent.outputUrl) {
    return NextResponse.json(
      { error: "parent generation not succeeded" },
      { status: 400 },
    );
  }
  if (parent.quality !== "hd") {
    return NextResponse.json(
      { error: "complete-the-look requires an HD generation" },
      { status: 400 },
    );
  }
  // The watermarked flag is plan-driven at serve time — only block pack
  // derivation if the user is currently on free. Paid users can spin off
  // packs from gens that were originally watermarked.
  if (parent.watermarked) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    const plan = (profile?.plan as string | undefined) ?? "free";
    if (plan === "free") {
      return NextResponse.json(
        { error: "complete-the-look requires an HD generation" },
        { status: 400 },
      );
    }
  }
  if (!parent.sceneifyGenerationId) {
    return NextResponse.json(
      { error: "parent generation has no sceneify id (legacy row)" },
      { status: 400 },
    );
  }
  if (parent.packId) {
    return NextResponse.json(
      { error: "cannot derive a pack from a pack shot" },
      { status: 400 },
    );
  }

  // Idempotency: same (parent, platform) returns the existing pack.
  const existing = await findExistingPack(parentGenerationId, platform);
  if (existing) {
    const shots = await listPackShots(existing.id);
    return NextResponse.json({ pack: existing, shots, deduplicated: true });
  }

  const cost = packCreditCost(platform);
  if (!isAdmin) {
    const ok = await tryDeductCredits(user.id, cost);
    if (!ok) {
      return NextResponse.json(
        {
          error: "insufficient credits",
          required: cost,
          platform,
        },
        { status: 402 },
      );
    }
  }

  let sceneifyResult;
  try {
    sceneifyResult = await completeLookViaSceneify({
      parentGenerationId: parent.sceneifyGenerationId,
      platform,
      callerRef: `vesperdrop:run:${runId}:gen:${parent.id}`,
    });
  } catch (err) {
    // Refund the credits we just debited — Sceneify never accepted the work.
    // Admins skipped the deduction, so nothing to refund.
    if (!isAdmin) await addCredits(user.id, cost);
    const message = err instanceof Error ? err.message : String(err);
    console.error("complete-look POST: sceneify call failed", message);
    return NextResponse.json(
      { error: "sceneify failed", detail: message },
      { status: 502 },
    );
  }

  const { pack, shots } = await createPackWithShots({
    runId,
    parentGenerationId: parent.id,
    parentSceneifySourceId: parent.sceneifySourceId,
    parentPresetId: parent.presetId,
    userId: user.id,
    platform,
    sceneifyPackId: sceneifyResult.packId,
    shots: sceneifyResult.shots.map((s) => ({
      sceneifyGenerationId: s.generationId,
      role: s.role,
      shotIndex: s.shotIndex,
    })),
    creditsSpent: cost,
  });

  return NextResponse.json({
    pack,
    shots,
    meta: LISTING_PACK_META[platform],
  });
}
