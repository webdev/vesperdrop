import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

// Stub: replaced by Agent B's Stripe money flow plan with a real
// implementation that retrieves the subscription, finds the metered
// overage item, and returns its id. Returning null here means Agent C's
// overage hook silently no-ops until Agent B lands the real version.
export async function findOverageSubscriptionItem(
  _subscriptionId: string,
): Promise<string | null> {
  return null;
}
