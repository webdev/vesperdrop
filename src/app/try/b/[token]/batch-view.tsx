/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useState } from "react";
import { track } from "@/lib/analytics";
import { type TileResult } from "../../develop-grid";
import { EditorialClaimRail, TrustRow } from "../../editorial-rail";
import {
  AdaptiveStudioLayout,
  SingleImageHeroLayout,
  StudioCompleteLayout,
} from "../../adaptive-studio-layout";
import { Lightbox } from "../../lightbox";
import type { UnlockBatchGeneration } from "@/lib/db/schema";

export function BatchView({
  token,
  generations,
  initialClaimed,
  initialPaid,
  sourceUrl,
  createdAt,
}: {
  token: string;
  generations: UnlockBatchGeneration[];
  initialClaimed: boolean;
  initialPaid: boolean;
  sourceUrl?: string;
  createdAt: string;
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
        track("checkout_started", { kind: "unlock", location: "batch" });
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
    track("checkout_started", { kind: "unlock", location: "batch" });
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
      <div className="mb-8 flex flex-col items-start justify-between gap-5 md:mb-10 md:flex-row md:items-end">
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
          {paid ? (
            <p className="mt-4 max-w-[44ch] font-serif text-[15.5px] leading-[1.5] text-ink-3">
              Your editorial set is ready.
              <br />
              {tileResults.length} campaign asset
              {tileResults.length === 1 ? "" : "s"} generated.
            </p>
          ) : null}
        </div>
        {paid ? (
          // Quiet action stack — status pill above, Download All pill
          // below. No giant buttons, no boxes; both pills sit in the
          // header so the gallery below can stay imagery-led.
          <div className="flex flex-col items-start gap-2.5 md:items-end">
            <div className="inline-flex items-center gap-2 rounded-full bg-terracotta-wash px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-terracotta-dark">
              <svg
                width="12"
                height="12"
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
              {tileResults.length} campaign asset
              {tileResults.length === 1 ? "" : "s"} ready
            </div>
            <button
              type="button"
              onClick={() => {
                for (const r of tileResults) handleDownload(r.sceneSlug);
              }}
              data-testid="studio-complete-download-all"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-ink-3 hover:bg-surface"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 3v12" />
                <path d="M6 9l6 6 6-6" />
                <path d="M5 21h14" />
              </svg>
              Download all assets
            </button>
          </div>
        ) : null}
      </div>

      {tileResults.length === 1 && tileResults[0] ? (
        // Single-image showcase. No upsell sidebar, no empty right
        // column — one cinematic hero dominates with editorial overlays.
        // Applies in BOTH paid and !paid states (the watermark / claim
        // gate is handled inside SingleImageHero via `unlocked`).
        <SingleImageHeroLayout
          tile={tileResults[0]}
          sourceUrl={sourceUrl}
          sceneNames={generations.map((g) => g.sceneName)}
          unlocked={paid || claimed}
          createdAt={createdAt}
          onDownloadClick={handleDownload}
          onPreviewClick={setLightboxSlug}
        />
      ) : paid ? (
        // Post-payment editorial spread: lightweight notes column +
        // asymmetric gallery. Download All + status pill live in the
        // header above, not inside the gallery — keeps the imagery
        // dominant and the chrome minimal.
        <StudioCompleteLayout
          results={tileResults}
          sourceUrl={sourceUrl}
          sceneNames={generations.map((g) => g.sceneName)}
          createdAt={createdAt}
          onPreviewClick={setLightboxSlug}
        />
      ) : (
        // Pre-payment monetization layout for 2- and 3-image batches.
        // Free hero is always the leftmost tile; locked previews are
        // blurred until paid; right rail carries the upsell ($9.99
        // single for 2, $14.99 bundle for 3). Single-image batches are
        // handled above with the dedicated showcase composition.
        <AdaptiveStudioLayout
          results={tileResults}
          sourceUrl={sourceUrl}
          sceneNames={generations.map((g) => g.sceneName)}
          claimed={claimed}
          paid={paid}
          unlockReady
          unlockSubmitting={unlockSubmitting}
          onDownloadClick={handleDownload}
          onUnlockClick={handleUnlock}
          onPreviewClick={setLightboxSlug}
        />
      )}

      {paid ? null : (
        <EditorialClaimRail
          generations={tileResults}
          claimed={claimed}
          onClaimSuccess={handleClaimSuccess}
          onUnlock={handleUnlock}
          unlockSubmitting={unlockSubmitting}
        />
      )}
      {paid ? null : <TrustRow />}

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

