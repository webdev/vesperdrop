import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe, createCheckoutSession } from "@/lib/stripe/server";
import {
  isPaidPlanSlug,
  PLAN_MARKETING,
  type BillingInterval,
  type PaidPlanSlug,
} from "@/lib/plans";

export const runtime = "nodejs";

const DEFAULT_PLAN: PaidPlanSlug = "pro";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestedPlan = url.searchParams.get("plan");
  const intervalParam = url.searchParams.get("interval");
  const interval: BillingInterval =
    intervalParam === "annual" ? "annual" : "monthly";

  if (requestedPlan && !isPaidPlanSlug(requestedPlan)) {
    return NextResponse.redirect(new URL("/pricing", req.url), { status: 303 });
  }
  const plan: PaidPlanSlug =
    (requestedPlan as PaidPlanSlug | null) ?? DEFAULT_PLAN;

  // Agency CTA never goes through checkout — route directly to /contact.
  // Defense in depth: Agent A's pricing UI also avoids /api/stripe/checkout
  // for Agency, but any stray link still lands here without a Stripe call.
  if (PLAN_MARKETING[plan].ctaTarget === "contact") {
    return NextResponse.redirect(
      new URL(`/contact?source=pricing-${plan}`, req.url),
      { status: 303 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in?next=/pricing", req.url), {
      status: 303,
    });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email!,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const cookieStore = await cookies();
  const etsyRef = cookieStore.get("vd_etsy_ref")?.value;

  const origin = new URL(req.url).origin;
  const session = await createCheckoutSession({
    slug: plan,
    interval,
    customerId,
    successUrl: `${origin}/account?upgraded=1&plan=${plan}&interval=${interval}`,
    cancelUrl: `${origin}/pricing`,
    metadata: {
      plan_slug: plan,
      user_id: user.id,
      ...(etsyRef ? { vd_etsy_ref: etsyRef } : {}),
    },
  });
  return NextResponse.redirect(session.url!, { status: 303 });
}
