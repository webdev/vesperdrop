import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import {
  isPaidPlanSlug,
  priceIdForPlan,
  type BillingInterval,
  type PaidPlanSlug,
} from "@/lib/plans";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

export interface CheckoutInput {
  customerEmail?: string | null;
  customerId?: string | null;
  slug: PaidPlanSlug;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<Stripe.Checkout.Session> {
  if (!isPaidPlanSlug(input.slug)) {
    throw new Error(`createCheckoutSession: invalid plan "${input.slug}"`);
  }
  const flatPriceId = priceIdForPlan(input.slug, input.interval);
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId ?? undefined,
    customer_email: input.customerId
      ? undefined
      : input.customerEmail ?? undefined,
    line_items: [{ price: flatPriceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    metadata: {
      ...input.metadata,
      vd_plan: input.slug,
      vd_interval: input.interval,
    },
    subscription_data: {
      metadata: {
        vd_plan: input.slug,
        vd_interval: input.interval,
      },
    },
  });
}
