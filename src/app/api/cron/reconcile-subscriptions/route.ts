import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { reconcileSubscriptions } from "@/lib/stripe/reconcile";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Daily reconciliation against Stripe.
 *
 * Vercel Cron (configured in vercel.json) sends an Authorization header of
 * `Bearer <CRON_SECRET>` when CRON_SECRET is set in env. This route refuses
 * any request that doesn't match — when CRON_SECRET is missing entirely we
 * also refuse, so a half-configured deploy can't be hit by anonymous traffic.
 */
export async function GET(req: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileSubscriptions();
    console.log("[reconcile] done", {
      scanned: result.scanned,
      updated: result.updated,
      unlinked: result.unlinked,
      unknownPrice: result.unknownPrice,
      errors: result.errors,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[reconcile] handler failed", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
