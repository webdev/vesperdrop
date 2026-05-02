import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CheckoutSuccessTracker } from "@/components/checkout-success-tracker";
import { PlanSummaryCard } from "@/components/app/plan-summary-card";
import { PlanGrid } from "@/components/app/plan-grid";
import { PageShell } from "@/components/ui/page-shell";
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
    <PageShell rhythm="loose">
      {upgraded === "1" ? <CheckoutSuccessTracker source="subscription" /> : null}

      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          Account
        </p>
        <h1 className="mt-3 font-serif text-[clamp(2.5rem,5vw,3.75rem)] leading-[0.98] tracking-[-0.02em] text-ink">
          Your workspace
        </h1>
        <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-4">
          {user.email}
        </p>
      </header>

      <section className="space-y-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Plan
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.1] tracking-[-0.01em] text-ink">
            Current subscription
          </h2>
        </div>
        <PlanSummaryCard
          plan={plan}
          creditsRemaining={profile?.credits_balance ?? 0}
          stripeCustomerId={profile?.stripe_customer_id ?? null}
          fallbackRenewsAt={profile?.plan_renews_at ?? null}
        />
      </section>

      <section className="space-y-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Plans
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.1] tracking-[-0.01em] text-ink">
            {plan === "free" ? "Pick a plan" : "Switch plans"}
          </h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
            Pro is the sweet spot for most sellers. Top-up packs coming soon.
          </p>
        </div>
        <PlanGrid tiers={tiers} currentPlan={plan} />
      </section>

      <form action="/api/auth/sign-out" method="post" className="pt-2">
        <button className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink">
          Sign out
        </button>
      </form>
    </PageShell>
  );
}
