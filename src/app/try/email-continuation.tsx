"use client";

import { useState } from "react";
import { useEmailPhotoSubmit, type EmailCaptureState } from "./email-capture";

type Props = {
  /**
   * The client-minted 32-hex batch token (`/try/b/<token>`). During
   * generation the run isn't finalized, so this is the durable key the
   * server stashes the pending email against (VES-46). Required for the
   * mid-generation submit path.
   */
  token?: string;
  /**
   * Finalized run id, when available (post-completion reuse). The server
   * accepts either runId or token; we send both when we have them.
   */
  runId?: string;
  /** Scene slugs previewed — recorded on try_intents for the ads record. */
  pickedScenes?: string[];
  /** Source product URL — recorded on try_intents (mid-generation). */
  sourceUrl?: string;
  /**
   * Mobile art-direction variant (VES-47): wider module, larger field/CTA,
   * stronger type, softer premium background, more vertical padding. The
   * desktop bottom-strip module uses the default ("desktop").
   */
  variant?: "desktop" | "mobile";
  /**
   * Fired once on the first server-confirmed success so the parent can
   * suppress the redundant post-completion email capture — one capture
   * system, not two competing asks (VES-42 decision #2 / §15a single Lead).
   */
  onCaptured?: () => void;
};

/**
 * "Don't want to wait here?" — the email-continuation module shown WHILE
 * generation is in flight (VES-45). Calm, low-friction notify-me moment,
 * NOT registration. Submitting hits /api/try/email-photo with the batch
 * `token`; mid-generation the server returns `state:"queued"` and defers
 * the send until finalize-batch commits, so the visitor can leave and still
 * receive the photos. On any server-confirmed success the shared hook fires
 * the Meta Pixel `Lead` exactly once (§15a).
 *
 * Copy is a notify-me moment, deliberately distinct from the locked primary
 * unlock CTA; it introduces no "Try free"/"free trial"/time-bound phrasing.
 */
export function EmailContinuationModule({
  token,
  runId,
  pickedScenes,
  sourceUrl,
  variant = "desktop",
  onCaptured,
}: Props) {
  const [email, setEmail] = useState("");
  const [doneState, setDoneState] = useState<EmailCaptureState | null>(null);
  const { status, errorMessage, submit } = useEmailPhotoSubmit();

  const submitting = status === "submitting";
  const disabled = submitting || !email.trim() || (!token && !runId);
  const isMobile = variant === "mobile";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    const result = await submit(email, {
      token,
      runId,
      pickedScenes,
      sourceUrl,
    });
    if (result.ok) {
      setDoneState(result.state);
      onCaptured?.();
    }
  }

  if (status === "success" && doneState) {
    const queued = doneState === "queued";
    return (
      <section
        data-testid="email-continuation"
        data-state={doneState}
        data-slot="email-module"
        className={
          isMobile
            ? "flex flex-col items-center gap-3 rounded-3xl bg-terracotta-wash/60 px-7 py-9 text-center"
            : "flex flex-col justify-center gap-2 rounded-2xl border border-terracotta/25 bg-terracotta-wash/50 px-6 py-6"
        }
      >
        <span
          aria-hidden
          className={`flex shrink-0 items-center justify-center rounded-full bg-terracotta text-cream ${
            isMobile ? "h-11 w-11" : "h-9 w-9"
          }`}
        >
          <CheckIcon size={isMobile ? 18 : 16} />
        </span>
        <p
          className={`font-serif tracking-[-0.005em] text-ink ${
            isMobile ? "text-[22px] leading-[1.15]" : "text-[19px] leading-tight"
          }`}
        >
          {queued ? "We'll email it the moment it's ready" : "Sent to your inbox"}
        </p>
        <p
          className={`text-ink-3 ${
            isMobile
              ? "max-w-[44ch] text-[15px] leading-[1.55]"
              : "text-[13px] leading-[1.45]"
          }`}
        >
          {queued
            ? "Generation continues in the background — you can safely leave this page. Check your inbox shortly."
            : "Your watermark-free photos are on their way. Check your inbox."}
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="email-continuation"
      data-slot="email-module"
      className={
        isMobile
          ? "rounded-3xl bg-terracotta-wash/60 px-7 py-9"
          : "flex flex-col justify-center rounded-2xl border border-terracotta/25 bg-terracotta-wash/40 px-6 py-6"
      }
    >
      <div
        className={
          isMobile
            ? "flex flex-col items-center gap-2 text-center"
            : "flex items-start gap-4"
        }
      >
        {/* Left terracotta animated icon */}
        <span
          aria-hidden
          className={`flex shrink-0 items-center justify-center rounded-full bg-terracotta/12 text-terracotta-dark ${
            isMobile ? "h-12 w-12" : "h-10 w-10"
          }`}
        >
          <span className="studio-pulse inline-flex">
            <EnvelopeIcon size={isMobile ? 20 : 17} />
          </span>
        </span>

        <div className={isMobile ? "" : "min-w-0 flex-1"}>
          <h3
            className={`font-serif tracking-[-0.01em] text-ink ${
              isMobile
                ? "text-[26px] leading-[1.1]"
                : "text-[20px] leading-[1.1]"
            }`}
          >
            Don&apos;t want to wait here?
          </h3>
          <p
            className={`text-ink-3 ${
              isMobile
                ? "mt-2 max-w-[42ch] text-[15px] leading-[1.55]"
                : "mt-1.5 max-w-[46ch] text-[13.5px] leading-[1.45]"
            }`}
          >
            Generation continues in the background. We&apos;ll send you an
            email as soon as it&apos;s ready.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className={
          isMobile
            ? "mt-6 flex flex-col gap-3"
            : "mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-stretch"
        }
      >
        <label htmlFor={`continuation-email-${variant}`} className="sr-only">
          Email address
        </label>
        <input
          id={`continuation-email-${variant}`}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          disabled={submitting}
          className={
            isMobile
              ? "min-w-0 flex-1 rounded-2xl border border-line bg-cream px-5 py-4 text-[16px] text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
              : "min-w-0 flex-1 rounded-full border border-line bg-cream px-5 py-3.5 text-[14px] text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
          }
        />
        <button
          type="submit"
          disabled={disabled}
          className={
            isMobile
              ? "inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-6 py-4 text-[15px] font-medium text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
              : "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[13.5px] font-medium text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
          }
        >
          {submitting ? "Sending…" : "Send me the result →"}
        </button>
      </form>

      <ReassuranceRow isMobile={isMobile} />

      {status === "error" && errorMessage ? (
        <p
          className={`text-[13px] text-rose-700 ${isMobile ? "mt-3 text-center" : "mt-3"}`}
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

function ReassuranceRow({ isMobile }: { isMobile: boolean }) {
  return (
    <ul
      className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-ink-3 ${
        isMobile
          ? "mt-4 justify-center text-[12.5px]"
          : "mt-3 text-[11.5px]"
      }`}
    >
      <li className="inline-flex items-center gap-1.5">
        <EnvelopeIcon size={12} /> No spam
      </li>
      <li aria-hidden className="text-ink-4">
        ·
      </li>
      <li className="inline-flex items-center gap-1.5">
        <LockIcon size={12} /> No password needed
      </li>
      <li aria-hidden className="text-ink-4">
        ·
      </li>
      <li className="inline-flex items-center gap-1.5">
        <ClockIcon size={12} /> Takes 10 seconds
      </li>
    </ul>
  );
}

function EnvelopeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ClockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
