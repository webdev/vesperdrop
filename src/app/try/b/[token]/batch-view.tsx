/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useState } from "react";
import { track } from "@/lib/analytics";
import { DevelopGrid, type TileResult } from "../../develop-grid";
import { EditorialClaimRail, TrustRow } from "../../editorial-rail";
import { StudioDevelopFrame } from "../../studio-frame";
import { Lightbox } from "../../lightbox";
import type { UnlockBatchGeneration } from "@/lib/db/schema";

export function BatchView({
  token,
  generations,
  initialClaimed,
  initialPaid,
  sourceUrl,
}: {
  token: string;
  generations: UnlockBatchGeneration[];
  initialClaimed: boolean;
  initialPaid: boolean;
  sourceUrl?: string;
}) {
  const [claimed, setClaimed] = useState(initialClaimed);
  const [paid] = useState(initialPaid);
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const [lightboxSlug, setLightboxSlug] = useState<string | null>(null);

  // Convert persisted batch entries into the TileResult shape that
  // DevelopGrid expects. All tiles are "succeeded" — there's no
  // streaming on this page. Post-payment we swap outputUrl for the
  // un-watermarked rawUrl so the editorial stage renders the real
  // HD asset directly (and pass `paid` to DevelopGrid to suppress
  // the watermark + Preview label overlays).
  const tileResults: TileResult[] = generations.map((g) => ({
    sceneSlug: g.sceneSlug,
    sceneName: g.sceneName,
    status: "succeeded",
    outputUrl: paid && g.rawUrl ? g.rawUrl : g.outputUrl,
    rawUrl: g.rawUrl ?? undefined,
    isFreePreview: g.isFreePreview,
    softLocked: !paid && !g.isFreePreview,
    focalPoint: g.focalPoint ?? null,
    faceBox: g.faceBox ?? null,
  }));

  // Cross-origin URLs (Vercel Blob) ignore the <a download> attribute
  // unless the response sets Content-Disposition: attachment, so the
  // browser opens them in a new tab instead of saving. Fetch the
  // resource as a blob and download via an object URL — that's
  // same-origin from the browser's perspective and bypasses the
  // disposition rule entirely.
  const triggerDownload = useCallback(
    async (url: string, filename: string) => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Revoke after a tick so the click has time to start the
        // download in some browsers.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } catch (err) {
        // Last-resort fallback: open in a new tab so the user can
        // right-click → Save image as.
        console.error("[batch-view] download failed", err);
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [],
  );

  const handleDownload = useCallback(
    (slug: string) => {
      track("try_tile_download_clicked", { slug });
      const gen = generations.find((g) => g.sceneSlug === slug);
      if (!gen) return;

      // Post-payment: every tile is entitled to its raw HD download.
      if (paid && gen.rawUrl) {
        void triggerDownload(
          gen.rawUrl,
          `${gen.sceneName.toLowerCase().replace(/\s+/g, "-")}.png`,
        );
        return;
      }

      // Hero post-claim (still unpaid): free HD download for the
      // free-preview tile.
      if (claimed && gen.isFreePreview) {
        void triggerDownload(
          gen.rawUrl ?? gen.outputUrl,
          `${gen.sceneName.toLowerCase().replace(/\s+/g, "-")}.png`,
        );
        return;
      }

      // Locked tile (not the free preview), pre-payment: kick off
      // the $9.99 Stripe checkout — that's how the user pays for
      // this image.
      if (!gen.isFreePreview) {
        if (unlockSubmitting) return;
        setUnlockSubmitting(true);
        window.location.href = `/api/stripe/unlock-checkout?batchToken=${token}`;
        return;
      }

      // Hero pre-claim: scroll the OTP form into view so the user
      // knows what to do next.
      const el = document.querySelector(
        '[data-testid="otp-email-input"]',
      ) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus();
    },
    [claimed, paid, generations, triggerDownload, token, unlockSubmitting],
  );

  const handleUnlock = useCallback(() => {
    track("try_unlock_clicked");
    if (unlockSubmitting) return;
    setUnlockSubmitting(true);
    window.location.href = `/api/stripe/unlock-checkout?batchToken=${token}`;
  }, [unlockSubmitting, token]);

  const handleClaimSuccess = useCallback(async () => {
    track("try_studio_claimed");
    try {
      await fetch("/api/try/attach-batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch {}
    setClaimed(true);
  }, [token]);

  const lightboxGen =
    lightboxSlug && generations.find((g) => g.sceneSlug === lightboxSlug);

  return (
    <>
      <div className="mb-10 flex flex-col items-start justify-between gap-4 md:mb-14 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            {paid ? "Your studio · Complete" : "Your studio · Saved"}
          </p>
          <h1 className="mt-5 font-serif text-[clamp(2.5rem,5.5vw,4rem)] leading-[1.04] tracking-[-0.02em] text-ink md:mt-6">
            In the{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              studio
            </em>
            .
          </h1>
        </div>
        {paid ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-terracotta-wash px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-terracotta-dark">
            <svg
              width="13"
              height="13"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2.5 6.5l2.5 2.5 4.5-5" />
            </svg>
            Studio set unlocked
          </div>
        ) : null}
      </div>

      {/* Single canonical post-generation shell: left rail (product +
          selected scenes + status) → middle grid → right rail / inline
          offer. Same StudioDevelopFrame used by /try during developing,
          so the persisted view at /try/b/[token] reads as one design,
          adapting only to the number of generations. DevelopGrid renders
          inside the middle slot to keep the existing watermark, download,
          unlock, and lightbox interactions. */}
      <StudioDevelopFrame
        results={tileResults}
        sourceUrl={sourceUrl}
        sceneNames={generations.map((g) => g.sceneName)}
        allDone
        renderGrid={({ results, count }) => (
          // Editorial DevelopGrid returns a fragment of `sm:order-N`
          // tile wrappers — the parent owns the grid container. We
          // mirror StudioGrid's per-count shapes (1 / 2 / 3 / 4–6) so
          // the post-generation view sits inside the exact same column
          // rhythm as the developing state.
          <div className={studioGridShapeClass(count)}>
            <DevelopGrid
              results={results}
              variant="darkroom"
              editorial
              // Post-payment all tiles are unlocked; pre-payment only
              // the free hero unlocks on claim. Threading `paid` through
              // as a global free-preview-unlocked flag is the cleanest
              // way to suppress every watermark + Preview label.
              freePreviewUnlocked={paid || claimed}
              paidAll={paid}
              onDownloadClick={handleDownload}
              onUnlockClick={handleUnlock}
              onPreviewClick={setLightboxSlug}
            />
          </div>
        )}
      />

      {paid ? null : (
        <EditorialClaimRail
          generations={tileResults}
          claimed={claimed}
          onClaimSuccess={handleClaimSuccess}
          onUnlock={handleUnlock}
          unlockSubmitting={unlockSubmitting}
        />
      )}
      <TrustRow />

      <Lightbox
        image={
          lightboxGen
            ? {
                sceneName: lightboxGen.sceneName,
                outputUrl: lightboxGen.outputUrl,
                rawUrl: lightboxGen.rawUrl,
                isFreePreview: lightboxGen.isFreePreview,
              }
            : null
        }
        claimed={claimed}
        onClose={() => setLightboxSlug(null)}
        onDownload={() => {
          if (!lightboxGen) return;
          // Close the lightbox so the OTP-scroll behavior (pre-claim
          // path) is visible behind it. Post-claim this is harmless;
          // the actual download fires asynchronously via blob fetch.
          setLightboxSlug(null);
          handleDownload(lightboxGen.sceneSlug);
        }}
        onUnlock={() => {
          setLightboxSlug(null);
          handleUnlock();
        }}
      />
    </>
  );
}

// Mirror of `StudioGrid`'s per-count container shapes — kept in sync so
// the developing state and the persisted /try/b/[token] state share the
// same column rhythm. Anything beyond 6 tiles falls into the 3-col grid
// (StudioDevelopFrame already caps the visible set at MAX_VISIBLE_CARDS).
function studioGridShapeClass(count: number): string {
  if (count <= 1) return "grid grid-cols-1 gap-4";
  if (count === 2) {
    return "grid grid-cols-1 gap-3 sm:grid-cols-[1.55fr_1fr] sm:gap-4";
  }
  if (count === 3) return "grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4";
  return "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3";
}

