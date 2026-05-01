import Link from "next/link";
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
    <div className="space-y-8 max-w-5xl">
      {upgraded === "1" ? <CheckoutSuccessTracker source="subscription" /> : null}
      <header>
        <h1 className="font-serif text-3xl">Account</h1>
        <p className="text-sm text-[var(--color-ink-3)]">{user.email}</p>
      </header>

      <section className="space-y-5">
        <PlanSummaryCard
          plan={plan}
          creditsRemaining={profile?.credits_balance ?? 0}
          stripeCustomerId={profile?.stripe_customer_id ?? null}
          fallbackRenewsAt={profile?.plan_renews_at ?? null}
        />
        <PlanGrid tiers={tiers} currentPlan={plan} />
        <p className="text-xs text-[var(--color-ink-3)]">
          Need more this month? Top-up packs coming soon.
        </p>
      </section>

      <section className="border border-[var(--color-line)] rounded p-6 bg-[var(--color-cream)]">
        <h2 className="font-serif text-xl mb-4">Security</h2>
        <Link
          href="/account/mfa"
          className="text-sm underline text-[var(--color-ink-2)] hover:text-[var(--color-ember)] transition-colors"
        >
          Two-factor authentication (TOTP) →
        </Link>
      </section>

      <form action="/api/auth/sign-out" method="post">
        <button className="underline text-sm text-[var(--color-ink-3)]">
          Sign out
        </button>
      </form>
    </div>
  );
}
