"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { identify, track } from "@/lib/analytics";

type FlowState =
  | { kind: "email" }
  | { kind: "sending"; email: string }
  | { kind: "code"; email: string }
  | { kind: "verifying"; email: string; code: string }
  | { kind: "success"; email: string };

type Props = {
  /**
   * Called once verifyOtp resolves with a session. The session has
   * already been written to the auth store at this point — callers
   * just need to react (refresh data, swap UI, etc.).
   */
  onSuccess?: (args: { email: string; userId: string }) => void | Promise<void>;
  /**
   * Optional copy overrides. Defaults match the /try cinematic reveal.
   * Pass `null` to suppress the header entirely (useful when embedded
   * in a page that already provides its own h1).
   */
  eyebrow?: string | null;
  description?: React.ReactNode | null;
  /**
   * Track which surface fired the flow so analytics can compare conversion
   * across /try inline, AuthModal, sign-in page, etc.
   */
  surface: string;
  /**
   * Layout variant. "vertical" (default) centers the form and shows
   * an inline submit button below the input — used by AuthModal,
   * /sign-in, /sign-up, preview-cta. "horizontal" places the input
   * and the Send code pill side-by-side — used by the /try inline
   * claim section where the headline lives in a parent column.
   */
  layout?: "vertical" | "horizontal";
  /**
   * Success-state copy. Defaults to the /try cinematic reveal ("✓ Studio
   * claimed"). Pass `null` to suppress it entirely on surfaces where the
   * post-auth navigation already conveys success (e.g. /sign-in routes
   * straight to /app or back through the checkout flow).
   */
  successMessage?: React.ReactNode | null;
  /**
   * Whether to autofocus the email input on mount. Defaults to true,
   * which is correct for AuthModal, /sign-in, /sign-up, and /try where
   * the form is the primary focus. Set to false on marketing surfaces
   * that embed the form mid-document (e.g. preview-cta) — otherwise
   * the browser scroll-anchors the input on load, jumping past the
   * hero.
   */
  autoFocusEmail?: boolean;
};

// Subtle but tactile motion. Springs feel right for the "claim" reveal;
// linear fades for the static dissolves.
const STATE_TRANSITION = {
  duration: 0.45,
  ease: [0.2, 0.8, 0.2, 1] as const,
};

export function OtpAuthFlow({
  onSuccess,
  eyebrow = "Claim your studio",
  description = "Save this batch and unlock your first HD image.",
  surface,
  layout = "vertical",
  successMessage = "✓ Studio claimed",
  autoFocusEmail = true,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const [state, setState] = useState<FlowState>({ kind: "email" });
  const [error, setError] = useState<string | null>(null);

  const sendOtp = useCallback(
    async (email: string) => {
      setError(null);
      setState({ kind: "sending", email });
      track("auth_otp_send_requested", { surface });
      // Supabase ships both `{{ .Token }}` and `{{ .ConfirmationURL }}`
      // in the email payload; even when the template only shows the
      // code, the underlying URL is still resolvable if the user
      // clicks the formatted link. The link points at Supabase's
      // verify endpoint, which then redirects to `redirect_to` — but
      // that URL needs to handle the code-exchange step or the
      // session never lands. Route through /api/auth/callback (which
      // exchanges the code) and tell it to forward to the current
      // page via ?next=. This way:
      //   - user enters OTP inline → redirect_to is unused (session
      //     created by verifyOtp), no side effect.
      //   - user clicks the link → callback exchanges, then forwards
      //     them back to /try/b/<token> with an active session.
      let emailRedirectTo: string | undefined;
      if (typeof window !== "undefined") {
        const next = window.location.pathname + window.location.search;
        emailRedirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
      }
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo },
      });
      if (sendError) {
        setError(sendError.message);
        setState({ kind: "email" });
        return;
      }
      (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.("track", "Lead");
      setState({ kind: "code", email });
    },
    [supabase, surface],
  );

  const verifyOtp = useCallback(
    async (email: string, code: string) => {
      setError(null);
      setState({ kind: "verifying", email, code });
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (verifyError || !data.session) {
        setError(verifyError?.message ?? "Verification failed");
        setState({ kind: "code", email });
        return;
      }
      const userId = data.session.user.id;
      identify(userId, { email });
      track("auth_otp_verified", { surface });
      setState({ kind: "success", email });
      await onSuccess?.({ email, userId });
    },
    [supabase, surface, onSuccess],
  );

  const resend = useCallback(
    async (email: string) => {
      setError(null);
      track("auth_otp_resend", { surface });
      await sendOtp(email);
    },
    [sendOtp, surface],
  );

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <AnimatePresence mode="wait" initial={false}>
        {(state.kind === "email" || state.kind === "sending") && (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={STATE_TRANSITION}
            className="flex w-full max-w-md flex-col items-center gap-4"
          >
            {eyebrow !== null ? (
              <Header eyebrow={eyebrow} description={description} />
            ) : null}
            <EmailForm
              busy={state.kind === "sending"}
              onSubmit={sendOtp}
              error={error}
              layout={layout}
              autoFocus={autoFocusEmail}
            />
          </motion.div>
        )}

        {(state.kind === "code" || state.kind === "verifying") && (
          <motion.div
            key="code"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={STATE_TRANSITION}
            className="flex w-full max-w-md flex-col items-center gap-4"
          >
            <Header
              eyebrow="Enter verification code"
              description={
                <>
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-ink">{state.email}</span>
                </>
              }
            />
            <CodeForm
              busy={state.kind === "verifying"}
              error={error}
              onSubmit={(code) => verifyOtp(state.email, code)}
              onResend={() => resend(state.email)}
            />
          </motion.div>
        )}

        {state.kind === "success" && successMessage !== null && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={STATE_TRANSITION}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-dark"
          >
            {successMessage}
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

function EmailForm({
  busy,
  onSubmit,
  error,
  layout = "vertical",
  autoFocus = true,
}: {
  busy: boolean;
  onSubmit: (email: string) => void;
  error: string | null;
  layout?: "vertical" | "horizontal";
  autoFocus?: boolean;
}) {
  const [email, setEmail] = useState("");

  if (layout === "horizontal") {
    // Inline pill-shaped input + filled terracotta CTA on the same
    // row. Used by the /try claim section where the heading + subcopy
    // live in the parent column — the form itself is just controls.
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          onSubmit(email.trim());
        }}
        className="flex w-full flex-col gap-2"
      >
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
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
            className="flex-1 rounded-full border border-line bg-surface px-5 py-3.5 text-[15px] text-ink placeholder:text-ink-4 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20 disabled:opacity-60"
            data-testid="otp-email-input"
          />
          <button
            type="submit"
            disabled={busy || email.length === 0}
            data-testid="otp-email-submit"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-7 py-3.5 font-mono text-[12px] uppercase tracking-[0.16em] text-cream transition-colors hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send code"}
            <span
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </button>
        </div>
        {error ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-orange-500">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  // Vertical (default): underline-style input centered, ghost button
  // below. Used by AuthModal, /sign-in, /sign-up, preview-cta.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        onSubmit(email.trim());
      }}
      className="flex w-full flex-col items-center gap-3"
    >
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        autoFocus={autoFocus}
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={busy}
        className="w-full max-w-[360px] border-0 border-b border-line bg-transparent px-1 py-3 text-center font-serif text-[clamp(1.125rem,1.6vw,1.375rem)] text-ink placeholder:text-ink-4 focus:border-terracotta focus:outline-none disabled:opacity-60"
        data-testid="otp-email-input"
      />
      <button
        type="submit"
        disabled={busy || email.length === 0}
        data-testid="otp-email-submit"
        className="group inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.18em] text-ink transition-colors hover:text-terracotta-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Sending…" : "Continue"}
        <span
          aria-hidden
          className="transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </button>
      {error ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-orange-500">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function CodeForm({
  busy,
  error,
  onSubmit,
  onResend,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
  onResend: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(6).fill(""));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const submittedRef = useRef(false);
  useEffect(() => {
    if (busy) return;
    const joined = digits.join("");
    if (joined.length === 6 && !submittedRef.current) {
      submittedRef.current = true;
      onSubmit(joined);
    }
    if (joined.length < 6) {
      submittedRef.current = false;
    }
  }, [digits, busy, onSubmit]);

  const setDigit = (idx: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length === 0) {
      setDigits((d) => {
        const next = [...d];
        next[idx] = "";
        return next;
      });
      return;
    }
    // Paste support: if a longer string arrives, splat it across cells.
    if (clean.length > 1) {
      setDigits((d) => {
        const next = [...d];
        for (let i = 0; i < clean.length && idx + i < 6; i++) {
          next[idx + i] = clean[i];
        }
        return next;
      });
      const lastIdx = Math.min(idx + clean.length, 5);
      inputsRef.current[lastIdx]?.focus();
      return;
    }
    setDigits((d) => {
      const next = [...d];
      next[idx] = clean;
      return next;
    });
    if (idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  const onKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && digits[idx] === "" && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) inputsRef.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="flex items-center gap-2"
        role="group"
        aria-label="6-digit verification code"
      >
        {digits.map((d, i) => (
          <input
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={i === 0 ? 6 : 1}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            value={d}
            disabled={busy}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            className="h-14 w-11 border-0 border-b-2 border-line bg-transparent text-center font-serif text-[1.5rem] text-ink focus:border-terracotta focus:outline-none disabled:opacity-60"
            data-testid={`otp-code-input-${i}`}
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        {error ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-orange-500">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onResend}
          disabled={busy}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Resend code
        </button>
      </div>
    </div>
  );
}
