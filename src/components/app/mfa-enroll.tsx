"use client";
import { useState, useEffect, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EnrollStep = "idle" | "scan" | "verify" | "done";

type Props = {
  /** Pass the enrolled factor ID if one already exists so we show the remove option */
  existingFactorId?: string;
};

export function MfaEnroll({ existingFactorId }: Props) {
  const supabase = createSupabaseBrowserClient();

  const [step, setStep] = useState<EnrollStep>(existingFactorId ? "done" : "idle");
  const [factorId, setFactorId] = useState(existingFactorId ?? "");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // ── Start enrollment ──────────────────────────────────────────────────────

  function startEnroll() {
    setError(null);
    start(async () => {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error || !data) { setError(error?.message ?? "Enrollment failed"); return; }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStep("scan");
    });
  }

  // ── Verify the scanned code ───────────────────────────────────────────────

  function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr || !challenge) { setError(challengeErr?.message ?? "Challenge failed"); return; }

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: totpCode.replace(/\s/g, ""),
      });
      if (verifyErr) { setError(verifyErr.message); return; }
      setStep("done");
    });
  }

  // ── Remove MFA ────────────────────────────────────────────────────────────

  function removeMfa() {
    if (!factorId) return;
    setError(null);
    start(async () => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) { setError(error.message); return; }
      setFactorId("");
      setQrCode(null);
      setSecret(null);
      setTotpCode("");
      setStep("idle");
    });
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-2)] px-4 py-3">
          <span className="mt-0.5 text-[var(--color-ember)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">Two-factor authentication is active</p>
            <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">
              Your account is secured with an authenticator app.
            </p>
          </div>
        </div>
        {error && <p className="text-sm text-[var(--color-ember)]">{error}</p>}
        <button
          type="button"
          onClick={removeMfa}
          disabled={pending}
          className="text-xs text-[var(--color-ink-3)] underline underline-offset-2 hover:text-[var(--color-ember)] transition-colors"
        >
          {pending ? "Removing…" : "Remove authenticator"}
        </button>
      </div>
    );
  }

  if (step === "scan") {
    return (
      <div className="space-y-5">
        <p className="text-sm text-[var(--color-ink-2)]">
          Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code to confirm.
        </p>

        {qrCode && (
          <div className="flex justify-center">
            {/* Supabase returns a data URI (SVG) for the QR code */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCode}
              alt="MFA QR code"
              width={160}
              height={160}
              className="rounded-lg border border-[var(--color-line)] bg-white p-2"
            />
          </div>
        )}

        {secret && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-[var(--color-ink-3)] hover:text-[var(--color-ink)] list-none">
              Can&rsquo;t scan? Enter code manually ↓
            </summary>
            <code className="mt-2 block break-all rounded bg-[var(--color-paper-2)] px-3 py-2 font-mono text-xs tracking-[0.1em] text-[var(--color-ink)]">
              {secret}
            </code>
          </details>
        )}

        <form onSubmit={verifyEnroll} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="totp-verify">Authenticator code</Label>
            <Input
              id="totp-verify"
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
          {error && <p className="text-sm text-[var(--color-ember)]">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Verifying…" : "Activate two-factor auth"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => { setStep("idle"); setError(null); setTotpCode(""); }}
          className="w-full text-center text-xs text-[var(--color-ink-3)] hover:text-[var(--color-ink)] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  // idle
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-ink-2)]">
        Add a time-based one-time password (TOTP) to your account. You&rsquo;ll need an authenticator app like Google Authenticator, Authy, or 1Password.
      </p>
      {error && <p className="text-sm text-[var(--color-ember)]">{error}</p>}
      <Button onClick={startEnroll} disabled={pending} variant="outline" className="w-full">
        {pending ? "Setting up…" : "Set up authenticator app"}
      </Button>
    </div>
  );
}
