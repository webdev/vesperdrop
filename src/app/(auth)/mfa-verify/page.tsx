"use client";
import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function MfaVerifyForm() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/app";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.[0];
      if (!factor) { setError("No authenticator found. Sign in again."); return; }

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: code.replace(/\s/g, ""),
      });
      if (error) { setError(error.message); return; }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-2)] px-4 py-3 text-sm text-[var(--color-ink-2)]">
        Enter the 6-digit code from your authenticator app to continue.
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Authenticator code</Label>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000 000"
            maxLength={7}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center tracking-[0.3em] text-lg"
          />
        </div>
        {error && <p className="text-sm text-[var(--color-ember)]">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Verifying…" : "Continue"}
        </Button>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <h1 className="font-serif text-3xl mb-2">Two-factor verification</h1>
      <p className="text-sm text-[var(--color-ink-3)] mb-6">
        Your account is protected with an authenticator app.
      </p>
      <Suspense>
        <MfaVerifyForm />
      </Suspense>
    </>
  );
}
