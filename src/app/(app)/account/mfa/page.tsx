import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MfaEnroll } from "@/components/app/mfa-enroll";

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const existingFactor = factors?.totp?.[0];

  return (
    <div className="mx-auto max-w-md py-12 px-6">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
        Account security
      </p>
      <h1 className="mb-2 font-serif text-3xl font-light text-[var(--color-ink)]">
        Two-factor authentication
      </h1>
      <p className="mb-8 font-serif text-base font-light text-[var(--color-ink-2)]">
        Add an authenticator app to your account for an extra layer of security.
        You&rsquo;ll be prompted for a 6-digit code each time you sign in with email.
      </p>
      <MfaEnroll existingFactorId={existingFactor?.id} />
    </div>
  );
}
