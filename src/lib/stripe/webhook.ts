import "server-only";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const insert = await supabaseAdmin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (insert.error) {
    if ((insert.error as { code?: string }).code === "23505") return;
    throw insert.error;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const obj = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;
      await supabaseAdmin
        .from("profiles")
        .update({ plan: "pro", plan_renews_at: null })
        .eq("stripe_customer_id", customerId);
      return;
    }
    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      const obj = event.data.object as Stripe.Subscription;
      const customerId = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;
      await supabaseAdmin
        .from("profiles")
        .update({ plan: "free", plan_renews_at: null })
        .eq("stripe_customer_id", customerId);
      return;
    }
    case "customer.subscription.updated": {
      const obj = event.data.object as Stripe.Subscription;
      const customerId = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;
      const isActive = obj.status === "active" || obj.status === "trialing";
      const periodEnd = (obj as unknown as { current_period_end?: number }).current_period_end;
      await supabaseAdmin
        .from("profiles")
        .update({
          plan: isActive ? "pro" : "free",
          plan_renews_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        })
        .eq("stripe_customer_id", customerId);
      return;
    }
    default:
      return;
  }
}
