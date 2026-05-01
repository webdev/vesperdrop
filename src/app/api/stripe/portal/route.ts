import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { isPaidPlanSlug, priceIdForPlan } from "@/lib/plans";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", req.url), { status: 303 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.redirect(new URL("/account", req.url), { status: 303 });
  }
  const customerId = profile.stripe_customer_id;

  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const returnUrl = new URL("/account", req.url).toString();

  if (!to) {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.redirect(session.url, { status: 303 });
  }

  if (!isPaidPlanSlug(to)) {
    return new NextResponse("invalid plan", { status: 400 });
  }
  const targetPriceId = priceIdForPlan(to);

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });
  const sub = subs.data[0];
  if (!sub) {
    return NextResponse.redirect(
      new URL(`/api/stripe/checkout?plan=${to}`, req.url),
      { status: 303 },
    );
  }
  const itemId = sub.items.data[0]?.id;
  if (!itemId) {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.redirect(session.url, { status: 303 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    flow_data: {
      type: "subscription_update_confirm",
      subscription_update_confirm: {
        subscription: sub.id,
        items: [{ id: itemId, price: targetPriceId, quantity: 1 }],
      },
    },
  });
  return NextResponse.redirect(session.url, { status: 303 });
}
