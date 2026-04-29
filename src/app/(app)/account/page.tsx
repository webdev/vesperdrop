import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CheckoutSuccessTracker } from "@/components/checkout-success-tracker";
import { UpgradeButton } from "@/components/app/upgrade-button";

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

  return (
    <div className="space-y-8 max-w-xl">
      {upgraded === "1" ? <CheckoutSuccessTracker source="subscription" /> : null}
      <header>
        <h1 className="font-serif text-3xl">Account</h1>
        <p className="text-sm text-[var(--color-ink-3)]">{user.email}</p>
      </header>
      <section className="border border-[var(--color-line)] rounded p-6 bg-[var(--color-cream)]">
        <h2 className="font-serif text-xl mb-4">Security</h2>
        <Link
          href="/account/mfa"
          className="text-sm underline text-[var(--color-ink-2)] hover:text-[var(--color-ember)] transition-colors"
        >
          Two-factor authentication (TOTP) →
        </Link>
      </section>
      <section className="border border-[var(--color-line)] rounded p-6 bg-[var(--color-cream)]">
        <h2 className="font-serif text-xl mb-4">Plan</h2>
        <p className="capitalize">{profile?.plan ?? "free"}</p>
        <p className="text-sm text-[var(--color-ink-3)] mt-2">
          {profile?.credits_balance ?? 0} credit{(profile?.credits_balance ?? 0) === 1 ? "" : "s"} remaining
        </p>
        {profile?.plan_renews_at && (
          <p className="text-xs text-[var(--color-ink-3)] mt-1">
            Renews {new Date(profile.plan_renews_at).toLocaleDateString()}
          </p>
        )}
        <div className="mt-6 flex items-center gap-4">
          {profile?.plan === "pro" ? (
            <a href="/api/stripe/portal" className="underline">
              Manage subscription
            </a>
          ) : (
            <UpgradeButton />
          )}
          <form action="/api/auth/sign-out" method="post">
            <button className="underline text-[var(--color-ink-3)]">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
