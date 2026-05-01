"use client";

import Link from "next/link";

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
      ? "SAVING…"
      : status === "saved"
        ? "BATCH SAVED · N°01"
        : "SAVE FAILED · N°01";
  const headline =
    status === "saving" ? (
      <>
        Saving your <span className="italic">batch</span>…
      </>
    ) : status === "saved" ? (
      <>
        Saved to your <span className="italic">batches</span>.
      </>
    ) : (
      <>
        Couldn’t save your <span className="italic">batch</span>.
      </>
    );
  const microcopy =
    status === "saving"
      ? "Persisting to your account"
      : status === "saved"
        ? "Find it any time in History"
        : "Refresh to retry";

  const historyHref = runId
    ? `/app/history?claim=${encodeURIComponent(runId)}`
    : "/app/history";

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white"
      style={{ boxShadow: "0 -4px 24px rgba(27,25,21,0.10)" }}
      role="region"
      aria-label="Batch saved"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between md:gap-8 md:px-12 md:py-6">
        <div className="flex-1">
          <p
            className={`font-mono text-[10px] tracking-[0.2em] uppercase ${
              status === "error"
                ? "text-orange-500"
                : "text-zinc-500"
            }`}
          >
            {eyebrow}
          </p>
          <h2 className="mt-1.5 text-2xl  leading-tight text-zinc-900 md:text-3xl">
            {headline}
          </h2>
          <p className="mt-1.5 font-mono text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
            {microcopy}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-4">
          <Link
            href={historyHref}
            className={`inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-medium transition-transform md:px-8 md:py-4 ${
              status === "saving"
                ? "pointer-events-none bg-[var(--color-ink-3)] text-white opacity-70"
                : "bg-orange-500 text-white hover:scale-[1.02] hover:bg-[#a83c18]"
            }`}
            aria-disabled={status === "saving"}
            tabIndex={status === "saving" ? -1 : 0}
          >
            View in History →
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase underline-offset-4 hover:text-orange-500 hover:underline"
          >
            ← Try with another product
          </button>
        </div>
      </div>
      <div className="border-t border-zinc-200 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-2 text-center font-mono text-[10px] tracking-[0.18em] text-zinc-400 uppercase md:px-12">
          {status === "saved"
            ? "FREE · BATCH IN YOUR LIBRARY · DOWNLOAD ANYTIME"
            : status === "saving"
              ? "PERSISTING · DO NOT CLOSE THIS TAB"
              : "TRY AGAIN OR CONTACT SUPPORT"}
        </div>
      </div>
    </div>
  );
}
