import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CheckoutSuccessTracker } from "@/components/checkout-success-tracker";
import { PlanSummaryCard } from "@/components/app/plan-summary-card";
import { PlanGrid } from "@/components/app/plan-grid";
import { PAID_PLAN_SLUGS, PLAN_CATALOG, type PlanSlug } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/account");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, stripe_customer_id, plan_renews_at, credits_balance")
    .eq("id", user.id)
    .single();

  const { upgraded } = await searchParams;
  const plan: PlanSlug = (profile?.plan as PlanSlug | undefined) ?? "free";
  const tiers = PAID_PLAN_SLUGS.map((slug) => PLAN_CATALOG[slug]);

  return (
    <div className="space-y-12 max-w-5xl">
      {upgraded === "1" ? <CheckoutSuccessTracker source="subscription" /> : null}
      <header className="space-y-2">
        <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
          Account
        </p>
        <h1 className="text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-tight text-zinc-900">
          Your workspace
        </h1>
        <p className="text-sm text-zinc-500">{user.email}</p>
      </header>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
            Plan
          </p>
          <h2 className="text-xl font-semibold text-zinc-900">Current subscription</h2>
        </div>
        <PlanSummaryCard
          plan={plan}
          creditsRemaining={profile?.credits_balance ?? 0}
          stripeCustomerId={profile?.stripe_customer_id ?? null}
          fallbackRenewsAt={profile?.plan_renews_at ?? null}
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
            Plans
          </p>
          <h2 className="text-xl font-semibold text-zinc-900">
            {plan === "free" ? "Pick a plan" : "Switch plans"}
          </h2>
          <p className="text-sm text-zinc-500">
            Pro is the sweet spot for most sellers. Top-up packs coming soon.
          </p>
        </div>
        <PlanGrid tiers={tiers} currentPlan={plan} />
      </section>

      <form action="/api/auth/sign-out" method="post" className="pt-2">
        <button className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          Sign out
        </button>
      </form>
    </div>
  );
}
