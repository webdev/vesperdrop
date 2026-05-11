"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { OtpAuthFlow } from "./otp-auth-flow";

type Mode = "sign-in" | "sign-up";
type Variant = "stacked" | "split";

// Apple + Facebook OAuth are hidden by default; flip this back on to
// re-enable. Icons + handlers preserved below so it's a one-line edit.
const SHOW_APPLE_FACEBOOK_OAUTH = false;

/**
 * Email auth uses Supabase email OTP (6-digit code, no magic-link).
 * OAuth providers are retained as a parallel sign-in option and still
 * route through /api/auth/callback. MFA enforcement happens in
 * middleware (lib/supabase/middleware.ts) — users with TOTP enrolled
 * are redirected to /mfa-verify automatically after the OTP session
 * lands.
 *
 * The `mode` prop is kept for analytics + button copy only; OTP doesn't
 * actually distinguish sign-in vs sign-up at the API layer
 * (shouldCreateUser:true creates if missing).
 */
export function AuthForm({
  mode = "sign-in",
  variant = "stacked",
  onSuccess,
  // Kept in the prop surface for callers that still pass it. The OTP
  // flow has no separate "pending email confirmation" step, so this
  // is never called.
  onConfirmationPending: _ignoredOnConfirmationPending,
  next: nextOverride,
}: {
  mode?: Mode;
  variant?: Variant;
  onSuccess?: () => void | Promise<void>;
  onConfirmationPending?: (email: string) => void;
  next?: string;
}) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = nextOverride ?? searchParams.get("next") ?? "/app";

  const [oauthError, setOauthError] = useState<string | null>(null);

  const handleOtpSuccess = useCallback(async () => {
    track(mode === "sign-up" ? "user_signed_up" : "user_signed_in", {
      method: "email",
    });
    if (onSuccess) {
      await onSuccess();
      return;
    }
    router.push(next);
    router.refresh();
  }, [mode, onSuccess, router, next]);

  const oauth = useCallback(
    (provider: "google" | "facebook" | "apple") => async () => {
      setOauthError(null);
      track(mode === "sign-up" ? "user_signed_up" : "user_signed_in", {
        method: provider,
      });
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
          ...(provider === "apple" ? { scopes: "name email" } : {}),
        },
      });
      if (error) setOauthError(error.message);
    },
    [supabase, mode, next],
  );

  const oauthBlock = (
    <div className="flex flex-col gap-2.5">
      <SocialButton
        icon={<GoogleIcon />}
        label="Continue with Google"
        onClick={oauth("google")}
      />
      {SHOW_APPLE_FACEBOOK_OAUTH ? (
        <>
          <SocialButton
            icon={<AppleIcon />}
            label="Continue with Apple"
            onClick={oauth("apple")}
          />
          <SocialButton
            icon={<FacebookIcon />}
            label="Continue with Facebook"
            onClick={oauth("facebook")}
          />
        </>
      ) : null}
      {oauthError ? (
        <p className="text-sm text-terracotta">{oauthError}</p>
      ) : null}
    </div>
  );

  const otpBlock = (
    <OtpAuthFlow
      surface={`auth_form_${mode}`}
      onSuccess={handleOtpSuccess}
      eyebrow={null}
      description={null}
      successMessage={null}
    />
  );

  if (variant === "split") {
    // Sign-in page layout: email path first (the most common return
    // visitor action), OAuth below the divider.
    return (
      <div className="flex flex-col gap-6">
        {otpBlock}
        <Divider label="or continue with" />
        {oauthBlock}
      </div>
    );
  }

  // Default stacked layout (sign-up page, AuthModal): OAuth first,
  // email path below. New visitors tend to skim toward one-click auth.
  return (
    <div className="flex flex-col gap-5">
      {oauthBlock}
      <Divider label="or email" />
      {otpBlock}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-line-soft" />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
        {label}
      </span>
      <div className="h-px flex-1 bg-line-soft" />
    </div>
  );
}

function SocialButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper-soft"
    >
      {icon}
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
      fill="#1877F2"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
      fill="currentColor"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
