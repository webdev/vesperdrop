import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/account");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, stripe_customer_id, plan_renews_at")
    .eq("id", user.id)
    .single();
  const ym = new Date().toISOString().slice(0, 7);
  const { data: usage } = await supabaseAdmin
    .from("usage_monthly")
    .select("generation_count")
    .eq("user_id", user.id)
    .eq("year_month", ym)
    .maybeSingle();

  const cap =
    profile?.plan === "pro"
      ? env.PLAN_PRO_MONTHLY_GENERATIONS
      : env.PLAN_FREE_MONTHLY_GENERATIONS;
  const used = usage?.generation_count ?? 0;

  return (
    <div className="space-y-8 max-w-xl">
      <header>
        <h1 className="font-serif text-3xl">Account</h1>
        <p className="text-sm text-[var(--color-ink-3)]">{user.email}</p>
      </header>
      <section className="border border-[var(--color-line)] rounded p-6 bg-[var(--color-cream)]">
        <h2 className="font-serif text-xl mb-4">Plan</h2>
        <p className="capitalize">{profile?.plan ?? "free"}</p>
        <p className="text-sm text-[var(--color-ink-3)] mt-2">
          {used} / {cap === 0 ? "unlimited" : cap} images this month
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
            <a
              href="/api/stripe/checkout"
              className="bg-[var(--color-ember)] text-white px-4 py-2 rounded"
            >
              Upgrade to Pro
            </a>
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
