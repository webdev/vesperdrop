"use client";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track, identify } from "@/lib/analytics";

type Mode = "sign-in" | "sign-up";
type Step = "credentials" | "mfa";

export function AuthForm({
  mode,
  onSuccess,
  next: nextOverride,
}: {
  mode: Mode;
  onSuccess?: () => void | Promise<void>;
  next?: string;
}) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = nextOverride ?? searchParams.get("next") ?? "/app";

  const [step, setStep] = useState<Step>("credentials");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // ── OAuth ─────────────────────────────────────────────────────────────────

  function oauthRedirect(provider: "google" | "facebook" | "apple") {
    return async () => {
      setError(null);
      track(mode === "sign-up" ? "user_signed_up" : "user_signed_in", { method: provider });
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
          ...(provider === "apple" ? { scopes: "name email" } : {}),
        },
      });
      if (error) setError(error.message);
    };
  }

  // ── Email / password ──────────────────────────────────────────────────────

  function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      if (mode === "sign-up") {
        const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
        if (error) { setError(error.message); return; }
        if (signUpData.user) {
          identify(signUpData.user.id, { email });
          track("user_signed_up", { method: "email" });
        }
        if (onSuccess) {
          await onSuccess();
          return;
        }
        router.push(next);
        router.refresh();
        return;
      }

      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); return; }
      if (signInData.user) {
        identify(signInData.user.id, { email });
        track("user_signed_in", { method: "email" });
      }

      // Check if MFA verification is required
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) {
          setFactorId(totp.id);
          setStep("mfa");
          return;
        }
      }

      if (onSuccess) {
        await onSuccess();
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  // ── MFA verify ────────────────────────────────────────────────────────────

  function submitMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    start(async () => {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: totpCode.replace(/\s/g, ""),
      });
      if (error) { setError(error.message); return; }
      if (onSuccess) {
        await onSuccess();
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  // ── MFA step ──────────────────────────────────────────────────────────────

  if (step === "mfa") {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          Enter the 6-digit code from your authenticator app.
        </div>
        <form onSubmit={submitMfa} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="totp">Authenticator code</Label>
            <Input
              id="totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000 000"
              maxLength={7}
              required
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="text-center tracking-[0.3em] text-lg"
            />
          </div>
          {error && <p className="text-sm text-orange-500">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Verifying…" : "Verify"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => { setStep("credentials"); setError(null); setTotpCode(""); }}
          className="w-full text-center text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          ← Back to sign in
        </button>
      </div>
    );
  }

  // ── Credentials step ──────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <SocialButton icon={<GoogleIcon />} label="Continue with Google" onClick={oauthRedirect("google")} />
        <SocialButton icon={<FacebookIcon />} label="Continue with Facebook" onClick={oauthRedirect("facebook")} />
        <SocialButton icon={<AppleIcon />} label="Continue with Apple" onClick={oauthRedirect("apple")} />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#e4e4e7]" />
        <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-400">OR EMAIL</span>
        <div className="h-px flex-1 bg-[#e4e4e7]" />
      </div>

      <form onSubmit={submitCredentials} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-orange-500">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}

function SocialButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
    >
      {icon}
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}
