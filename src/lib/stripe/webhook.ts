import "server-only";
import type Stripe from "stripe";
import { sql } from "drizzle-orm";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { db } from "@/lib/db";
import { refillCredits } from "@/lib/db/credits";
import { PLAN_MONTHLY_CREDITS } from "@/lib/ai/models";
import { env } from "@/lib/env";
import { getPostHogClient } from "@/lib/posthog-server";

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
 * Extract the subscription id from an invoice object.
 *
 * Stripe API 2025-04-30+ moved `invoice.subscription` to
 * `invoice.parent.subscription_details.subscription`. We read the new shape
 * first and fall back to the legacy field so older API versions and replayed
 * historical events keep working.
 */
function extractInvoiceSubscriptionId(obj: unknown): string | null {
  const o = obj as {
    subscription?: string | { id?: string } | null;
    parent?: {
      subscription_details?: { subscription?: string | { id?: string } | null };
    } | null;
  };
  const fromParent = o.parent?.subscription_details?.subscription;
  const fromTop = o.subscription;
  const value = fromParent ?? fromTop;
  if (!value) return null;
  return typeof value === "string" ? value : value.id ?? null;
}

/**
 * Extract the renewal date (unix seconds) from a Subscription.
 *
 * Stripe API 2025-04-30+ moved `current_period_end` from the Subscription
 * itself onto each subscription item. We read the item-level field first and
 * fall back to the legacy top-level one.
 */
function extractSubscriptionPeriodEnd(sub: unknown): number | null {
  const s = sub as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const itemEnd = s.items?.data?.[0]?.current_period_end;
  return itemEnd ?? s.current_period_end ?? null;
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
  const periodEnd = extractSubscriptionPeriodEnd(sub);
  const renewsAt = periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // fallback: +30 days
  return { plan, credits, renewsAt };
}

/**
 * Fire-and-forget PostHog capture — telemetry must never crash the webhook.
 * A 5xx triggers Stripe to retry, which can cause duplicate side effects.
 */
function safeCapture(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): void {
  try {
    getPostHogClient().capture(args);
  } catch (err) {
    console.error("[stripe-webhook] posthog capture failed", err);
  }
}

/**
 * Claim an event for processing. Returns true if the caller should proceed.
 *
 * Returns false only when a previous delivery already finished successfully
 * (completed_at is set). Returns true on first delivery AND on retries of
 * deliveries that did not finish — handlers must therefore tolerate being
 * re-invoked for the same event id (we mitigate the main non-idempotent
 * surface — credit grants — by only marking completed_at after the work
 * succeeds, so that any error short-circuits without re-granting).
 */
async function tryClaimEvent(id: string, type: string): Promise<boolean> {
  const insert = await supabaseAdmin
    .from("stripe_events")
    .insert({ id, type });

  // Fresh delivery — proceed.
  if (!insert.error) return true;

  const code = (insert.error as { code?: string }).code;
  if (code !== "23505") throw insert.error;

  // Row already exists — only skip if it ran to completion.
  const { data } = await supabaseAdmin
    .from("stripe_events")
    .select("completed_at")
    .eq("id", id)
    .single();

  const completed = data?.completed_at != null;
  if (completed) {
    console.log("[stripe-webhook] dedup-skip (already completed)", { id, type });
    return false;
  }
  console.warn("[stripe-webhook] retrying previously-failed event", { id, type });
  return true;
}

async function markEventComplete(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("stripe_events")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    // Don't throw — the work succeeded; logging completion is bookkeeping.
    console.error("[stripe-webhook] failed to mark event complete", { id, error });
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  // Serialize concurrent deliveries of the same event id (e.g. two webhook
  // endpoints, or a Stripe-side retry that races with the original delivery).
  // pg_advisory_xact_lock blocks until the holding tx ends, so the second
  // worker sees a completed row and dedup-skips. The lock auto-releases on
  // commit/rollback or if the session dies, so a crashed worker can never
  // wedge processing forever.
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${event.id}, 0))`,
    );
    if (!(await tryClaimEvent(event.id, event.type))) return;
    await dispatchStripeEvent(event);
    await markEventComplete(event.id);
  });
}

async function dispatchStripeEvent(event: Stripe.Event): Promise<void> {
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

      // Only set the plan name here. plan_renews_at is owned by
      // invoice.payment_succeeded / customer.subscription.updated — clobbering
      // it to null here can race with those events and leave the profile with
      // a correct plan but a missing renewal date.
      await supabaseAdmin
        .from("profiles")
        .update({ plan })
        .eq("stripe_customer_id", customerId);

      const activatedUserId = await getUserIdByCustomerId(customerId);
      if (activatedUserId) {
        safeCapture({
          distinctId: activatedUserId,
          event: "subscription_activated",
          properties: { plan },
        });
      }
      return;
    }

    // ------------------------------------------------------------------
    // Invoice paid — grant credits for every successful subscription
    // payment (initial activation + renewals).
    // ------------------------------------------------------------------
    case "invoice.payment_succeeded": {
      const obj = event.data.object as unknown as {
        customer?: string | { id?: string } | null;
      };
      // Only process subscription invoices (not one-off charges).
      // Reads parent.subscription_details.subscription (Dahlia API) with
      // fallback to the legacy top-level invoice.subscription field.
      const subscriptionId = extractInvoiceSubscriptionId(event.data.object);
      if (!subscriptionId) {
        console.log("[stripe-webhook] invoice has no subscription — skip", {
          eventId: event.id,
        });
        return;
      }

      const customerId =
        typeof obj.customer === "string"
          ? obj.customer
          : (obj.customer as { id?: string } | null)?.id;
      if (!customerId) {
        console.log("[stripe-webhook] invoice has no customer — skip", {
          eventId: event.id,
        });
        return;
      }

      const userId = await getUserIdByCustomerId(customerId);
      if (!userId) {
        console.warn("[stripe-webhook] no profile linked to customer — skip", {
          eventId: event.id,
          customerId,
        });
        return;
      }

      const resolved = await resolveSubscription(subscriptionId);
      if (!resolved) {
        console.warn("[stripe-webhook] could not resolve plan from subscription", {
          eventId: event.id,
          subscriptionId,
        });
        return;
      }

      await refillCredits(userId, resolved.plan, resolved.credits, resolved.renewsAt);

      safeCapture({
        distinctId: userId,
        event: "subscription_renewed",
        properties: { plan: resolved.plan, credits_granted: resolved.credits },
      });
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

      const cancelledUserId = await getUserIdByCustomerId(customerId);
      if (cancelledUserId) {
        safeCapture({
          distinctId: cancelledUserId,
          event: "subscription_cancelled",
          properties: { reason: event.type },
        });
      }
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
      const periodEnd = extractSubscriptionPeriodEnd(obj);

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

// Re-exported for tests; keeps the surface area of the module intentional.
export const __testing = {
  extractInvoiceSubscriptionId,
  extractSubscriptionPeriodEnd,
};
