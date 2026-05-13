/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type LightboxImage = {
  sceneName: string;
  outputUrl: string;
  rawUrl?: string | null;
  isFreePreview?: boolean;
};

// Click-to-enlarge overlay for /try generation tiles. Rendered at viewport
// scale with object-contain (no crop, no chrome). Watermark is whatever's
// baked into outputUrl; the un-watermarked rawUrl is only shown for the
// free hero once the visitor has claimed (post-OTP).
export function Lightbox({
  image,
  claimed,
  onClose,
  onDownload,
  onUnlock,
}: {
  image: LightboxImage | null;
  claimed: boolean;
  onClose: () => void;
  onDownload: () => void;
  onUnlock: () => void;
}) {
  // ESC dismisses. Body scroll locks while open so the page beneath
  // doesn't drift when the user trackpads.
  useEffect(() => {
    if (!image) return;
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
  }, [image, onClose]);

  if (!image) return null;

  const shouldShowRaw = claimed && image.isFreePreview === true && image.rawUrl;
  const imageUrl = shouldShowRaw ? (image.rawUrl as string) : image.outputUrl;
  const showUnlockCta = !image.isFreePreview;
  const showDownloadCta = image.isFreePreview === true;

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
        aria-label={`Enlarged view of ${image.sceneName}`}
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
            alt={image.sceneName}
            className="max-h-[80vh] max-w-[92vw] object-contain"
            draggable={false}
          />

          <div className="flex items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cream/70">
              {image.sceneName}
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
