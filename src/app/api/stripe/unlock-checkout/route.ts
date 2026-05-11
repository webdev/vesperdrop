import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { env } from "@/lib/env";
import {
  attachStripeSessionToBatch,
  getUnlockBatchByToken,
} from "@/lib/db/unlock-batches";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("batchToken");
  if (!token) {
    return NextResponse.json({ error: "missing batchToken" }, { status: 400 });
  }

  const batch = await getUnlockBatchByToken(token);
  if (!batch) {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (batch.status !== "pending") {
    return NextResponse.json(
      { error: `batch is ${batch.status}` },
      { status: 400 },
    );
  }

  const origin = url.origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: env.STRIPE_PRICE_UNLOCK, quantity: 1 }],
    success_url: `${origin}/try/b/${token}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/try`,
    metadata: { unlock_batch_token: token },
    client_reference_id: token,
  });

  await attachStripeSessionToBatch(token, session.id);

  if (!session.url) {
    return NextResponse.json(
      { error: "stripe did not return a checkout url" },
      { status: 502 },
    );
  }
  return NextResponse.redirect(session.url, { status: 303 });
}
