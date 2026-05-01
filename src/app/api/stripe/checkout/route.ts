import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { isPaidPlanSlug, priceIdForPlan, type PaidPlanSlug } from "@/lib/plans";

export const runtime = "nodejs";

const DEFAULT_PLAN: PaidPlanSlug = "pro";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in?next=/pricing", req.url), { status: 303 });
  }

  const url = new URL(req.url);
  const requestedPlan = url.searchParams.get("plan");
  if (requestedPlan && !isPaidPlanSlug(requestedPlan)) {
    return NextResponse.redirect(new URL("/pricing", req.url), { status: 303 });
  }
  const plan: PaidPlanSlug = (requestedPlan as PaidPlanSlug | null) ?? DEFAULT_PLAN;
  const priceId = priceIdForPlan(plan);

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

  const origin = new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/account?upgraded=1`,
    cancel_url: `${origin}/pricing`,
    allow_promotion_codes: true,
    metadata: { plan_slug: plan, user_id: user.id },
  });
  return NextResponse.redirect(session.url!, { status: 303 });
}
