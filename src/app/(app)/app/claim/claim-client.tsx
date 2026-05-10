/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const PENDING_BATCH_KEY = "vd_pending_batch";

type PendingBatch = {
  source: { url?: string; name: string };
  generations: Array<{
    sceneSlug: string;
    sceneName: string;
    outputUrl: string;
    rawUrl?: string;
  }>;
};

type ClaimStatus = "loading" | "claiming" | "saved" | "error" | "empty";

// Cross-origin Vercel Blob URLs ignore the <a download> attribute and just
// navigate, so we have to fetch the bytes ourselves and hand the browser a
// same-origin Blob URL. Falls back to opening the URL in a new tab if fetch
// or createObjectURL fail (e.g. CSP edge cases) — better than swallowing.
async function downloadFromUrl(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke after a tick so the click has time to start the save.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function ClaimClient() {
  // Hydrate from localStorage; sessionStorage is a fallback for stale tabs
  // that pre-date the storage swap. Read once on mount; the wizard wrote
  // these values before the user left to confirm their email.
  const [batch, setBatch] = useState<PendingBatch | null>(null);
  const [status, setStatus] = useState<ClaimStatus>("loading");
  const [runId, setRunId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let payload: PendingBatch | null = null;
    try {
      const raw =
        window.localStorage.getItem(PENDING_BATCH_KEY) ??
        window.sessionStorage.getItem(PENDING_BATCH_KEY);
      if (raw) payload = JSON.parse(raw) as PendingBatch;
    } catch {
      window.localStorage.removeItem(PENDING_BATCH_KEY);
      window.sessionStorage.removeItem(PENDING_BATCH_KEY);
    }

    if (!payload || payload.generations.length === 0) {
      setStatus("empty");
      return;
    }

    setBatch(payload);
    setStatus("claiming");

    (async () => {
      try {
        const res = await fetch("/api/try/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = (await res.json()) as { runId?: string };
        window.localStorage.removeItem(PENDING_BATCH_KEY);
        window.sessionStorage.removeItem(PENDING_BATCH_KEY);
        setRunId(data.runId ?? null);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    })();
  }, []);

  const handleDownload = useCallback(
    async (slug: string, url: string, sceneName: string) => {
      setDownloading(slug);
      try {
        await downloadFromUrl(
          url,
          `${sceneName.toLowerCase().replace(/\s+/g, "-")}.png`,
        );
      } finally {
        setDownloading(null);
      }
    },
    [],
  );

  // Esc closes the lightbox. Body scroll is locked while it's open so the
  // background page doesn't drift behind the overlay.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox]);

  if (status === "empty") {
    return (
      <div className="py-16 text-center" data-testid="claim-empty">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
          Claim · N°00
        </p>
        <h1 className="mt-4 font-serif text-[clamp(2.5rem,5vw,3.5rem)] leading-[1] tracking-[-0.02em] text-ink">
          Nothing to claim.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-[1.55] text-ink-3">
          Looks like there&apos;s no pending batch on this device. Open your
          library to see saved work, or start a fresh batch on{" "}
          <Link href="/try" className="text-terracotta underline underline-offset-4">
            /try
          </Link>
          .
        </p>
        <div className="mt-8">
          <Link
            href="/app/library"
            className="inline-flex items-center rounded-full bg-ink px-6 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-cream hover:bg-ink-2"
          >
            Open library →
          </Link>
        </div>
      </div>
    );
  }

  if (status === "loading" || !batch) {
    return (
      <div className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
        Loading your batch…
      </div>
    );
  }

  return (
    <div data-testid="claim-page">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
            Claim · N°01
          </p>
          <h1 className="mt-3 font-serif text-[clamp(2.75rem,5.5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-ink">
            Welcome to{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              Vesperdrop
            </em>
            .
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-[1.55] text-ink-3">
            Your batch is ready to download. We&apos;ve also saved it to your
            library so you can come back to it anytime.
          </p>
        </div>
        <ClaimStatusPill status={status} />
      </div>

      <div className="mt-10 grid grid-cols-1 items-start gap-8 md:grid-cols-[260px_1fr] md:gap-12">
        <aside>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-4">
            Your product
          </p>
          {batch.source.url ? (
            <button
              type="button"
              onClick={() =>
                setLightbox({
                  url: batch.source.url!,
                  name: batch.source.name,
                })
              }
              className="mt-3 block aspect-square w-full cursor-zoom-in overflow-hidden rounded-md border border-line-soft bg-surface transition-shadow hover:shadow-md"
              aria-label={`Enlarge ${batch.source.name}`}
            >
              <img
                src={batch.source.url}
                alt={batch.source.name}
                className="h-full w-full object-contain"
              />
            </button>
          ) : (
            <div className="mt-3 flex aspect-square items-center justify-center rounded-md border border-line-soft bg-paper-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
              {batch.source.name}
            </div>
          )}
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
            {batch.generations.length}{" "}
            {batch.generations.length === 1 ? "scene" : "scenes"}
          </p>
        </aside>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {batch.generations.map((g, idx) => {
            const isDownloading = downloading === g.sceneSlug;
            return (
              <article
                key={`${g.sceneSlug}-${idx}`}
                className="flex flex-col gap-3"
                data-testid="claim-tile"
              >
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({ url: g.outputUrl, name: g.sceneName })
                  }
                  className="group relative block aspect-[4/5] cursor-zoom-in overflow-hidden rounded-md bg-surface transition-shadow hover:shadow-md"
                  aria-label={`Enlarge ${g.sceneName}`}
                >
                  <img
                    src={g.outputUrl}
                    alt={g.sceneName}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/55 font-mono text-[14px] text-cream backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    ⤢
                  </span>
                </button>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-serif text-[18px] leading-tight tracking-[-0.01em] text-ink">
                      {g.sceneName}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
                      {String(idx + 1).padStart(2, "0")} /{" "}
                      {String(batch.generations.length).padStart(2, "0")}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="claim-download"
                    disabled={isDownloading}
                    onClick={() =>
                      handleDownload(g.sceneSlug, g.outputUrl, g.sceneName)
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDownloading ? (
                      <>
                        <span aria-hidden className="vd-spin">⟳</span>
                        Saving…
                      </>
                    ) : (
                      <>
                        <span aria-hidden>↓</span>
                        Download
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="mt-12 flex items-center justify-between border-t border-line-soft pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
          {status === "saved"
            ? "Saved to library"
            : status === "error"
              ? "Save failed — your library may be missing this batch"
              : "Saving to library…"}
        </p>
        <Link
          href={runId ? `/app/library?claim=${encodeURIComponent(runId)}` : "/app/library"}
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Open library →
        </Link>
      </div>

      {lightbox ? (
        <Lightbox
          url={lightbox.url}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}

function Lightbox({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      data-testid="claim-lightbox"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 backdrop-blur-sm md:p-10"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-cream/10 font-mono text-[16px] text-cream backdrop-blur-sm transition-colors hover:bg-cream/20"
      >
        ✕
      </button>
      <img
        src={url}
        alt={name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full cursor-default rounded-md object-contain shadow-2xl"
      />
    </div>
  );
}

function ClaimStatusPill({ status }: { status: ClaimStatus }) {
  const label =
    status === "saved"
      ? "Saved"
      : status === "error"
        ? "Save failed"
        : status === "claiming"
          ? "Saving…"
          : "—";
  const tone =
    status === "saved"
      ? "bg-terracotta-wash text-terracotta-dark"
      : status === "error"
        ? "bg-orange-100 text-orange-700"
        : "bg-paper-2 text-ink-3";
  return (
    <span
      data-testid="claim-status"
      data-status={status}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${tone}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
