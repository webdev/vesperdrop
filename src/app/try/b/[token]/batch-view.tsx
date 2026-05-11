/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { track } from "@/lib/analytics";
import { DevelopGrid, type TileResult } from "../../develop-grid";
import { EditorialClaimRail, TrustRow } from "../../editorial-rail";
import type { UnlockBatchGeneration } from "@/lib/db/schema";

export function BatchView({
  token,
  generations,
  initialClaimed,
  initialPaid,
}: {
  token: string;
  generations: UnlockBatchGeneration[];
  initialClaimed: boolean;
  initialPaid: boolean;
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
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            {paid ? "Your studio · Complete" : "Your studio · Saved"}
          </p>
          <h1 className="mt-4 font-serif text-[clamp(2.5rem,5.5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-ink">
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

      {/* Same full-bleed editorial stage as /try post-success. */}
      <div className="relative -mx-[calc(50vw-50%)] w-screen">
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_2fr_1fr] sm:gap-3">
          <DevelopGrid
            results={tileResults}
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
      </div>

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
        gen={lightboxGen || null}
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

// Full-screen click-to-enlarge overlay. Image rendered at viewport
// scale with object-contain (no crop, no chrome) so the user sees the
// composition properly. Watermark is the same baked-in one as the
// tile; rendering the rawUrl is gated on (claimed && isFreePreview).
function Lightbox({
  gen,
  claimed,
  onClose,
  onDownload,
  onUnlock,
}: {
  gen: UnlockBatchGeneration | null;
  claimed: boolean;
  onClose: () => void;
  onDownload: () => void;
  onUnlock: () => void;
}) {
  // ESC to dismiss. Plus lock body scroll while the overlay is open
  // so the page beneath doesn't move when the user trackpads.
  useEffect(() => {
    if (!gen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [gen, onClose]);

  if (!gen) return null;

  // Hero post-claim shows the un-watermarked rawUrl. Everything else
  // shows the watermarked outputUrl — the user still sees the lighting,
  // composition, and quality, just with the diagonal mark.
  const shouldShowRaw = claimed && gen.isFreePreview && gen.rawUrl;
  const imageUrl = shouldShowRaw ? (gen.rawUrl as string) : gen.outputUrl;
  const showUnlockCta = !gen.isFreePreview; // locked tiles in the set
  // Hero post-claim: real download. Hero pre-claim: same handler,
  // which scrolls the OTP form into view. Either way the lightbox
  // closes so the user sees the action surface.
  const showDownloadCta = gen.isFreePreview;
  const downloadLabel = claimed ? "Download HD" : "Claim to download HD";

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/90 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Enlarged view of ${gen.sceneName}`}
      >
        <motion.div
          key="lightbox-content"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative flex max-h-[92vh] max-w-[92vw] flex-col items-center gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={imageUrl}
            alt={gen.sceneName}
            className="max-h-[80vh] max-w-[92vw] object-contain"
            draggable={false}
          />

          <div className="flex items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cream/70">
              {gen.sceneName}
              {shouldShowRaw ? " · HD" : " · Preview"}
            </p>
            {showDownloadCta ? (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cream transition-colors hover:bg-terracotta-dark"
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
                Download HD
              </button>
            ) : null}
            {showUnlockCta ? (
              <button
                type="button"
                onClick={onUnlock}
                className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cream transition-colors hover:bg-terracotta-dark"
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
                  <rect x="4" y="11" width="16" height="10" rx="1.5" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Unlock for $9.99
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="absolute -top-2 right-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-cream/15 text-cream backdrop-blur-sm transition-colors hover:bg-cream/25 md:-top-12 md:right-0"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
