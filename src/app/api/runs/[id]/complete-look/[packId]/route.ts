import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  derivePackStatus,
  getPackForUser,
  listPackShots,
  syncPackShotsFromSceneify,
  updatePackStatus,
} from "@/lib/db/packs";
import { getCompleteLookStatus } from "@/lib/ai/sceneify";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
  const { packId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const pack = await getPackForUser(packId, user.id);
  if (!pack) return NextResponse.json({ error: "not found" }, { status: 404 });

  // If our local rows are already terminal, skip the upstream call.
  const localShots = await listPackShots(packId);
  const localDone = localShots.every(
    (s) => s.status === "succeeded" || s.status === "failed",
  );
  if (localDone) {
    return NextResponse.json({ pack, shots: localShots });
  }

  // Reconcile against Sceneify.
  try {
    const status = await getCompleteLookStatus(pack.sceneifyPackId);
    await syncPackShotsFromSceneify(packId, status.shots);
    const next = await listPackShots(packId);
    const succeeded = next.filter((s) => s.status === "succeeded").length;
    const failed = next.filter((s) => s.status === "failed").length;
    const derived = derivePackStatus({ total: next.length, succeeded, failed });
    if (derived !== pack.status) {
      await updatePackStatus(packId, derived);
    }
    return NextResponse.json({
      pack: { ...pack, status: derived },
      shots: next,
    });
  } catch (err) {
    // Fall back to local view; surface the error so the UI can decide.
    const message = err instanceof Error ? err.message : String(err);
    console.error("complete-look GET: sceneify status failed", message);
    return NextResponse.json(
      { pack, shots: localShots, error: "sceneify_unreachable", detail: message },
      { status: 200 },
    );
  }
}
