import "server-only";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { env } from "@/lib/env";
import { PLAN_MONTHLY_CREDITS } from "@/lib/ai/models";

export type ReconcileResult = {
  scanned: number;
  updated: number;
  unlinked: number;
  unknownPrice: number;
  errors: number;
  changes: Array<{
    customerId: string;
    userId: string | null;
    from: { plan: string | null; renewsAt: string | null };
    to: { plan: string; renewsAt: string | null };
  }>;
};

function priceIdToPlan(priceId: string): string | null {
  const map: Record<string, string> = {
    [env.STRIPE_PRO_PRICE_ID]: "pro",
    [env.STRIPE_STARTER_PRICE_ID]: "starter",
    [env.STRIPE_STUDIO_PRICE_ID]: "studio",
    [env.STRIPE_AGENCY_PRICE_ID]: "agency",
  };
  return map[priceId] ?? null;
}

/**
 * Pick the subscription that should drive the customer's plan when a customer
 * has multiple active subscriptions. We rank by monthly credits (a proxy for
 * tier), breaking ties with most-recently-created.
 */
function pickPrimary(
  subs: Stripe.Subscription[],
): Stripe.Subscription | null {
  let best: { sub: Stripe.Subscription; credits: number } | null = null;
  for (const sub of subs) {
    const priceId = sub.items.data[0]?.price?.id;
    const plan = priceId ? priceIdToPlan(priceId) : null;
    const credits = plan ? (PLAN_MONTHLY_CREDITS[plan] ?? 0) : 0;
    if (
      !best ||
      credits > best.credits ||
      (credits === best.credits && sub.created > best.sub.created)
    ) {
      best = { sub, credits };
    }
  }
  return best?.sub ?? null;
}

function periodEnd(sub: Stripe.Subscription): number | null {
  const item = sub.items.data[0] as unknown as { current_period_end?: number };
  const fromItem = item?.current_period_end;
  const fromTop = (sub as unknown as { current_period_end?: number }).current_period_end;
  return fromItem ?? fromTop ?? null;
}

/**
 * Reconcile every Stripe customer with active subscriptions against our
 * profiles table. Plan + renewal-date drift gets fixed in place; missing
 * profiles are logged. Credits are intentionally not touched — granting
 * credits requires an audit table to dedupe against past invoices.
 */
export async function reconcileSubscriptions(): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    scanned: 0,
    updated: 0,
    unlinked: 0,
    unknownPrice: 0,
    errors: 0,
    changes: [],
  };

  const byCustomer = new Map<string, Stripe.Subscription[]>();

  for await (const sub of stripe.subscriptions.list({
    status: "active",
    limit: 100,
    expand: ["data.items.data.price"],
  })) {
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (!customerId) continue;
    const list = byCustomer.get(customerId) ?? [];
    list.push(sub);
    byCustomer.set(customerId, list);
  }

  for (const [customerId, subs] of byCustomer) {
    result.scanned += 1;
    const primary = pickPrimary(subs);
    if (!primary) continue;
    const priceId = primary.items.data[0]?.price?.id;
    const plan = priceId ? priceIdToPlan(priceId) : null;
    if (!plan) {
      result.unknownPrice += 1;
      console.warn("[reconcile] unknown price id", { customerId, priceId });
      continue;
    }
    const pe = periodEnd(primary);
    const renewsAt = pe ? new Date(pe * 1000).toISOString() : null;

    const { data: profile, error: selErr } = await supabaseAdmin
      .from("profiles")
      .select("id, plan, plan_renews_at")
      .eq("stripe_customer_id", customerId)
      .single();

    if (selErr || !profile) {
      result.unlinked += 1;
      console.warn("[reconcile] no profile linked to customer", { customerId });
      continue;
    }

    const currentRenews = profile.plan_renews_at
      ? new Date(profile.plan_renews_at).toISOString()
      : null;
    if (profile.plan === plan && currentRenews === renewsAt) continue;

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ plan, plan_renews_at: renewsAt })
      .eq("id", profile.id);

    if (upErr) {
      result.errors += 1;
      console.error("[reconcile] failed to update profile", {
        customerId,
        userId: profile.id,
        error: upErr,
      });
      continue;
    }

    result.updated += 1;
    result.changes.push({
      customerId,
      userId: profile.id,
      from: { plan: profile.plan ?? null, renewsAt: currentRenews },
      to: { plan, renewsAt },
    });
  }

  return result;
}
