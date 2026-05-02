"use client";

import Link from "next/link";
import { Container } from "@/components/ui/container";

type SaveStatus = "saving" | "saved" | "error";

export function SavedBar({
  status,
  runId,
  onReset,
}: {
  status: SaveStatus;
  runId: string | null;
  onReset: () => void;
}) {
  const eyebrow =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Batch saved · N°01"
        : "Save failed · N°01";
  const headline =
    status === "saving" ? (
      <>
        Saving your{" "}
        <em className="not-italic font-serif italic text-terracotta-dark">
          batch
        </em>
        …
      </>
    ) : status === "saved" ? (
      <>
        Saved to your{" "}
        <em className="not-italic font-serif italic text-terracotta-dark">
          library
        </em>
        .
      </>
    ) : (
      <>
        Couldn&rsquo;t save your{" "}
        <em className="not-italic font-serif italic text-terracotta-dark">
          batch
        </em>
        .
      </>
    );
  const microcopy =
    status === "saving"
      ? "Persisting to your account"
      : status === "saved"
        ? "Find it any time in your library"
        : "Refresh to retry";

  const historyHref = runId
    ? `/app/library?claim=${encodeURIComponent(runId)}`
    : "/app/library";

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-surface shadow-[0_-4px_24px_rgba(43,32,24,0.08)]"
      role="region"
      aria-label="Batch saved"
    >
      <Container width="app" className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between md:gap-8 md:py-6">
        <div className="flex-1">
          <p
            className={`font-mono text-[11px] uppercase tracking-[0.12em] ${
              status === "error" ? "text-terracotta" : "text-ink-3"
            }`}
          >
            {eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.5rem,2.5vw,2rem)] leading-[1.1] tracking-[-0.01em] text-ink">
            {headline}
          </h2>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
            {microcopy}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-4">
          <Link
            href={historyHref}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors md:px-8 ${
              status === "saving"
                ? "pointer-events-none bg-ink-3 text-cream opacity-70"
                : "bg-terracotta text-cream hover:bg-terracotta-dark"
            }`}
            aria-disabled={status === "saving"}
            tabIndex={status === "saving" ? -1 : 0}
          >
            View in library <span aria-hidden>→</span>
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            ← Try with another product
          </button>
        </div>
      </Container>
      <div className="border-t border-line-soft bg-paper-soft">
        <Container width="app" className="py-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
          {status === "saved"
            ? "Free · batch in your library · download anytime"
            : status === "saving"
              ? "Persisting · do not close this tab"
              : "Try again or contact support"}
        </Container>
      </div>
    </div>
  );
}
