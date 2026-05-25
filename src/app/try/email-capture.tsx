"use client";

import { useCallback, useState } from "react";

export type EmailCapturePhoto = { presetId: string; url: string };

/** Delivery state returned by /api/try/email-photo (VES-46). */
export type EmailCaptureState = "sent" | "queued";

export type EmailCaptureResponse = {
  ok: boolean;
  state?: EmailCaptureState;
  emailed?: boolean;
  photos?: EmailCapturePhoto[];
  warning?: string;
  error?: string;
  message?: string;
};

/**
 * Identifies the batch for /api/try/email-photo. Post-completion callers
 * have a finalized `runId`; mid-generation callers (during the cinematic
 * Develop step) only have the client-minted `token` since finalize-batch
 * hasn't run yet. At least one is required by the server (VES-46). When a
 * `token` is sent mid-generation the server stashes the email and defers
 * the send until finalize-batch commits — so it works even if the tab is
 * closed.
 */
export type EmailCaptureTarget = {
  runId?: string;
  token?: string;
  /** Scene slugs previewed — recorded on try_intents (mid-generation). */
  pickedScenes?: string[];
  /** Source product URL — recorded on try_intents (mid-generation). */
  sourceUrl?: string;
};

export type EmailSubmitResult =
  | { ok: true; state: EmailCaptureState; emailed: boolean; photos: EmailCapturePhoto[] }
  | { ok: false; message: string };

/**
 * Shared submit + Meta Pixel `Lead` logic for BOTH /try email captures —
 * the post-completion reward (`EmailCapture`) and the mid-generation
 * continuation module (`EmailContinuationModule`, VES-45). Centralising it
 * here means the `Lead` pixel fires exactly once per server-confirmed
 * success regardless of which surface submitted (CLAUDE.md §15a), and both
 * surfaces stay copy/behaviour consistent (§9 — one capture system, not a
 * parallel form).
 */
export function useEmailPhotoSubmit() {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = useCallback(
    async (
      email: string,
      target: EmailCaptureTarget,
    ): Promise<EmailSubmitResult> => {
      setStatus("submitting");
      setErrorMessage(null);

      const body: Record<string, unknown> = { email: email.trim() };
      if (target.runId) body.runId = target.runId;
      if (target.token) body.token = target.token;
      if (target.pickedScenes?.length) body.pickedScenes = target.pickedScenes;
      if (target.sourceUrl) body.sourceUrl = target.sourceUrl;

      try {
        const res = await fetch("/api/try/email-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data: EmailCaptureResponse = await res.json();

        if (!res.ok || !data.ok) {
          const message =
            data.message ??
            (res.status === 429
              ? "Too many emails right now. Try again in an hour."
              : "Something went wrong. Try again in a moment.");
          setStatus("error");
          setErrorMessage(message);
          return { ok: false, message };
        }

        // Server-confirmed success — fire Lead exactly once. Wrapped so a
        // missing Pixel can't break the user-visible reveal.
        try {
          const fbq = (
            window as unknown as { fbq?: (...args: unknown[]) => void }
          ).fbq;
          fbq?.("track", "Lead", { content_name: "try_email_photo" });
        } catch {
          // analytics swallow
        }

        setStatus("success");
        return {
          ok: true,
          state: data.state ?? "sent",
          emailed: data.emailed ?? false,
          photos: data.photos ?? [],
        };
      } catch {
        const message = "Couldn't reach the server. Check your connection.";
        setStatus("error");
        setErrorMessage(message);
        return { ok: false, message };
      }
    },
    [],
  );

  return { status, errorMessage, submit } as const;
}

type Props = {
  runId: string;
  onSuccess: (photos: EmailCapturePhoto[], emailed: boolean) => void;
};

// Inline email capture rendered directly below the watermarked previews
// on /try. Single-field form, fires server-side `try_intents` insert +
// Resend email, then fires the Meta Pixel `Lead` event in the success
// callback. The locked free-tier rule (CLAUDE.md §15a) now delivers
// all 3 watermark-free outputs as the reward — no $9.99 per-image
// unlock for unauth visitors.
export function EmailCapture({ runId, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const { status, errorMessage, submit } = useEmailPhotoSubmit();

  const submitting = status === "submitting";
  const disabled = submitting || !email.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    const result = await submit(email, { runId });
    if (result.ok) onSuccess(result.photos, result.emailed);
  }

  if (status === "success") {
    return (
      <section className="rounded-xl border border-line-soft bg-paper p-4 md:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
          Done · Sent to your inbox
        </p>
        <h3 className="mt-2 font-serif text-[clamp(1.25rem,2.4vw,2rem)] leading-[1.1] tracking-[-0.01em] text-ink md:mt-3">
          Watermark-free photos are yours.
        </h3>
        <p className="mt-2 max-w-[60ch] text-[13.5px] leading-[1.5] text-ink-3 md:mt-3 md:text-[14px] md:leading-[1.55]">
          Check <strong className="text-ink">{email}</strong> for the HD
          download links. The photos are also revealed below — right-click
          any image to save.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="email-capture"
      className="rounded-xl border border-terracotta/30 bg-paper p-4 md:p-8"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-terracotta-dark">
        Get all 3 photos · Watermark-free
      </p>
      <h3 className="mt-2 font-serif text-[clamp(1.25rem,2.6vw,2.125rem)] leading-[1.08] tracking-[-0.01em] text-ink md:mt-3 md:leading-[1.05]">
        Like what you see?{" "}
        <em className="not-italic font-serif italic text-terracotta-dark">
          We&rsquo;ll send the watermark-free versions.
        </em>
      </h3>
      <p className="mt-2 max-w-[58ch] text-[13.5px] leading-[1.5] text-ink-3 md:mt-3 md:text-[14px] md:leading-[1.55]">
        All 3 photos, full resolution, no watermark — delivered to your
        inbox. No card required. First one&rsquo;s on us.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-stretch md:mt-5 md:gap-3"
        noValidate
      >
        <label htmlFor="try-email" className="sr-only">
          Email address
        </label>
        <input
          id="try-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@brand.com"
          className="min-w-0 flex-1 rounded-full border border-line bg-cream px-5 py-3.5 font-mono text-[13px] text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send me my photos →"}
        </button>
      </form>

      <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3 md:mt-3">
        No spam · Unsubscribe anytime · If you don&rsquo;t love the photos,
        reply and we&rsquo;ll regenerate
      </p>

      {status === "error" && errorMessage ? (
        <p className="mt-3 text-[13px] text-rose-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
