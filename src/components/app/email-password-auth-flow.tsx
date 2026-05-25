"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { identify, track } from "@/lib/analytics";

type FlowState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; email: string };

type Props = {
  /**
   * Called once a real Supabase session lands in-place (password
   * sign-in / sign-up). The session cookie is already written at this
   * point — callers just react (attach the batch, swap UI, navigate).
   *
   * NOT called for the Google path: OAuth does a full-page redirect to
   * /api/auth/callback, so this component unmounts before a session
   * exists. Callers route the post-OAuth reconciliation through the
   * `next` destination instead (see `googleNext`).
   */
  onSuccess?: (args: { email: string; userId: string }) => void | Promise<void>;
  /**
   * Optional header copy. Pass `null` to suppress the header entirely
   * (useful when embedded in a page/modal that already provides its
   * own h1 + description).
   */
  eyebrow?: string | null;
  description?: React.ReactNode | null;
  /** Analytics surface label so conversion can be compared per mount. */
  surface: string;
  /**
   * Layout variant. "vertical" (default) stacks the fields and submit
   * button. "horizontal" keeps the controls compact for the /try inline
   * claim rail where the headline lives in the parent column.
   */
  layout?: "vertical" | "horizontal";
  /**
   * Success-state copy shown after an in-place password auth. Pass
   * `null` to suppress (e.g. surfaces where post-auth navigation already
   * conveys success).
   */
  successMessage?: React.ReactNode | null;
  /** Autofocus the email field on mount. Defaults to true. */
  autoFocusEmail?: boolean;
  /**
   * Where to send the user after Google OAuth completes (passed to
   * /api/auth/callback?next=). Must start with "/". Defaults to the
   * current path so the user lands back where they started with a live
   * session — surfaces that need a specific reconciliation target (e.g.
   * /try routing through /try/b/<token> so the server auto-attaches the
   * batch) pass it explicitly.
   */
  googleNext?: string;
  /**
   * Render the built-in "Continue with Google" button + divider.
   * Defaults to true. Set false on surfaces that already render their
   * own OAuth block (auth-form, preview-cta) so we don't double up the
   * Google button.
   */
  showGoogle?: boolean;
};

const STATE_TRANSITION = {
  duration: 0.45,
  ease: [0.2, 0.8, 0.2, 1] as const,
};

export function EmailPasswordAuthFlow({
  onSuccess,
  eyebrow = "Claim your studio",
  description = "Save this batch and unlock your first HD image.",
  surface,
  layout = "vertical",
  successMessage = "✓ Studio claimed",
  autoFocusEmail = true,
  googleNext,
  showGoogle = true,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const [state, setState] = useState<FlowState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setState({ kind: "submitting" });

      // Returning user first: signInWithPassword. On invalid_credentials
      // we fall through to signUp so a single form serves both new and
      // returning users (mirrors the old OTP shouldCreateUser:true
      // behavior — one input, no sign-in/sign-up toggle).
      const signIn = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signIn.data.session) {
        const userId = signIn.data.session.user.id;
        identify(userId, { email });
        track("auth_password_signin", { surface });
        setState({ kind: "success", email });
        await onSuccess?.({ email, userId });
        return;
      }

      const invalidCreds =
        signIn.error?.code === "invalid_credentials" ||
        /invalid login credentials/i.test(signIn.error?.message ?? "");

      if (signIn.error && !invalidCreds) {
        setError(signIn.error.message);
        setState({ kind: "idle" });
        return;
      }

      const signUp = await supabase.auth.signUp({ email, password });
      if (signUp.error) {
        setError(signUp.error.message);
        setState({ kind: "idle" });
        return;
      }
      if (!signUp.data.session) {
        // No session means Supabase "Confirm email" is still enabled —
        // signUp returns a user but defers the session until the emailed
        // link is clicked, which is exactly the confirmation step this
        // flow removes. Surface a clear error rather than silently
        // leaving the user stuck.
        setError(
          "Account created, but email confirmation is enabled. Please contact support — confirmation must be disabled for instant access.",
        );
        setState({ kind: "idle" });
        return;
      }

      const userId = signUp.data.session.user.id;
      identify(userId, { email });
      track("auth_signup", { surface });
      (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.(
        "track",
        "Lead",
      );
      setState({ kind: "success", email });
      await onSuccess?.({ email, userId });
    },
    [supabase, surface, onSuccess],
  );

  const continueWithGoogle = useCallback(async () => {
    setError(null);
    track("auth_google_start", { surface });
    let next = googleNext;
    if (!next && typeof window !== "undefined") {
      next = window.location.pathname + window.location.search;
    }
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next ?? "/app")}`
        : undefined;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthError) setError(oauthError.message);
  }, [supabase, surface, googleNext]);

  return (
    <div className="flex w-full flex-col items-center gap-4 text-center">
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === "success" && successMessage !== null ? (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={STATE_TRANSITION}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-dark"
          >
            {successMessage}
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={STATE_TRANSITION}
            className="flex w-full max-w-md flex-col items-center gap-4"
          >
            {eyebrow !== null ? (
              <Header eyebrow={eyebrow} description={description} />
            ) : null}
            <CredentialForm
              busy={state.kind === "submitting"}
              onSubmit={submit}
              onGoogle={continueWithGoogle}
              showGoogle={showGoogle}
              error={error}
              layout={layout}
              autoFocus={autoFocusEmail}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({
  eyebrow,
  description,
}: {
  eyebrow: string | null;
  description: React.ReactNode | null;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <h2 className="font-serif text-[clamp(1.5rem,2.2vw,2rem)] leading-[1.05] tracking-[-0.01em] text-ink">
        {eyebrow}
      </h2>
      <p className="text-[14px] leading-[1.5] text-ink-3">{description}</p>
    </div>
  );
}

function CredentialForm({
  busy,
  onSubmit,
  onGoogle,
  showGoogle,
  error,
  layout = "vertical",
  autoFocus = true,
}: {
  busy: boolean;
  onSubmit: (email: string, password: string) => void;
  onGoogle: () => void;
  showGoogle: boolean;
  error: string | null;
  layout?: "vertical" | "horizontal";
  autoFocus?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const canSubmit = email.length > 0 && password.length > 0;

  const inputBase =
    "w-full rounded-full border border-line bg-surface px-5 py-3.5 text-[15px] text-ink placeholder:text-ink-4 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20 disabled:opacity-60";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || !canSubmit) return;
        onSubmit(email.trim(), password);
      }}
      className="flex w-full flex-col gap-3"
    >
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        autoFocus={autoFocus}
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={busy}
        className={inputBase}
        data-testid="auth-email-input"
      />
      <input
        type="password"
        autoComplete="current-password"
        required
        minLength={6}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={busy}
        className={inputBase}
        data-testid="auth-password-input"
      />
      <button
        type="submit"
        disabled={busy || !canSubmit}
        data-testid="auth-submit"
        className="group inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-7 py-3.5 font-mono text-[12px] uppercase tracking-[0.16em] text-cream transition-colors hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Continuing…" : "Continue"}
        <span
          aria-hidden
          className="transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </button>

      {showGoogle ? (
        <>
          <div className="my-1 flex items-center gap-3">
            <span className="h-px flex-1 bg-line-soft" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
              or
            </span>
            <span className="h-px flex-1 bg-line-soft" />
          </div>

          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            data-testid="auth-google"
            className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-paper px-4 py-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </>
      ) : null}

      {error ? (
        <p
          className={`font-mono text-[10px] uppercase tracking-[0.14em] text-orange-500 ${
            layout === "horizontal" ? "" : "text-center"
          }`}
        >
          {error}
        </p>
      ) : null}
    </form>
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
