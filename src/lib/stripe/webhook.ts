import "server-only";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { refillCredits } from "@/lib/db/credits";
import { PLAN_MONTHLY_CREDITS } from "@/lib/ai/models";
import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a Stripe price ID to a Vesperdrop plan name using env-configured price IDs.
 * Returns null when the price ID is not recognised.
 */
function priceIdToPlan(priceId: string): string | null {
  const map: Record<string, string> = {
    [env.STRIPE_PRO_PRICE_ID]: "pro",
  };
  if (env.STRIPE_STARTER_PRICE_ID) map[env.STRIPE_STARTER_PRICE_ID] = "starter";
  if (env.STRIPE_STUDIO_PRICE_ID) map[env.STRIPE_STUDIO_PRICE_ID] = "studio";
  if (env.STRIPE_AGENCY_PRICE_ID) map[env.STRIPE_AGENCY_PRICE_ID] = "agency";
  return map[priceId] ?? null;
}

/** Look up the Supabase user ID for a given Stripe customer ID. */
async function getUserIdByCustomerId(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data?.id ?? null;
}

/**
 * Retrieve a subscription from Stripe with its price items expanded,
 * then return the resolved plan name and period-end ISO string.
 */
async function resolveSubscription(
  subscriptionId: string,
): Promise<{ plan: string; credits: number; renewsAt: string } | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId ? priceIdToPlan(priceId) : null;
  if (!plan) return null;
  const credits = PLAN_MONTHLY_CREDITS[plan] ?? 0;
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  const renewsAt = periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // fallback: +30 days
  return { plan, credits, renewsAt };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  // Deduplicate — 23505 = unique constraint violation (already processed)
  const insert = await supabaseAdmin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (insert.error) {
    if ((insert.error as { code?: string }).code === "23505") return;
    throw insert.error;
  }

  switch (event.type) {
    // ------------------------------------------------------------------
    // Subscription created via Checkout — update plan column.
    // Credits are granted by invoice.payment_succeeded (billing_reason:
    // "subscription_create") which fires at the same time.
    // ------------------------------------------------------------------
    case "checkout.session.completed": {
      const obj = event.data.object as Stripe.Checkout.Session;
      const customerId =
        typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;

      // Determine the plan from the subscription items if possible.
      const subscriptionId =
        typeof obj.subscription === "string"
          ? obj.subscription
          : (obj.subscription as Stripe.Subscription | null)?.id;

      let plan = "pro"; // safe default until invoice event fires
      if (subscriptionId) {
        const resolved = await resolveSubscription(subscriptionId);
        if (resolved) plan = resolved.plan;
      }

      await supabaseAdmin
        .from("profiles")
        .update({ plan, plan_renews_at: null })
        .eq("stripe_customer_id", customerId);
      return;
    }

    // ------------------------------------------------------------------
    // Invoice paid — grant credits for every successful subscription
    // payment (initial activation + renewals).
    // ------------------------------------------------------------------
    case "invoice.payment_succeeded": {
      const obj = event.data.object as unknown as {
        customer?: string | { id?: string } | null;
        subscription?: string | { id?: string } | null;
      };
      // Only process subscription invoices (not one-off charges)
      const subscriptionId =
        typeof obj.subscription === "string"
          ? obj.subscription
          : (obj.subscription as { id?: string } | null)?.id;
      if (!subscriptionId) return;

      const customerId =
        typeof obj.customer === "string"
          ? obj.customer
          : (obj.customer as { id?: string } | null)?.id;
      if (!customerId) return;

      const userId = await getUserIdByCustomerId(customerId);
      if (!userId) return;

      const resolved = await resolveSubscription(subscriptionId);
      if (!resolved) return;

      await refillCredits(userId, resolved.plan, resolved.credits, resolved.renewsAt);
      return;
    }

    // ------------------------------------------------------------------
    // Subscription cancelled or paused — downgrade to free.
    // ------------------------------------------------------------------
    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      const obj = event.data.object as Stripe.Subscription;
      const customerId =
        typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;
      await supabaseAdmin
        .from("profiles")
        .update({ plan: "free", plan_renews_at: null })
        .eq("stripe_customer_id", customerId);
      return;
    }

    // ------------------------------------------------------------------
    // Subscription updated — sync plan name and renewal date.
    // Credit refills are handled by invoice.payment_succeeded above.
    // ------------------------------------------------------------------
    case "customer.subscription.updated": {
      const obj = event.data.object as Stripe.Subscription;
      const customerId =
        typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;
      const isActive = obj.status === "active" || obj.status === "trialing";
      const periodEnd = (obj as unknown as { current_period_end?: number })
        .current_period_end;

      // Determine the plan from subscription items.
      const priceId = obj.items?.data[0]?.price?.id;
      const plan = priceId ? (priceIdToPlan(priceId) ?? (isActive ? "pro" : "free")) : (isActive ? "pro" : "free");

      await supabaseAdmin
        .from("profiles")
        .update({
          plan: isActive ? plan : "free",
          plan_renews_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        })
        .eq("stripe_customer_id", customerId);
      return;
    }

    default:
      return;
  }
}
