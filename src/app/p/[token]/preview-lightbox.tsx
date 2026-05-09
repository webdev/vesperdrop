"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaceSafeImage } from "@/components/ui/face-safe-image";
import type { PreviewGeneratedImage } from "@/lib/preview-pages/loader";

type Props = {
  images: PreviewGeneratedImage[];
  index: number | null;
  onClose: () => void;
  onNavigate: (next: number) => void;
};

const SWIPE_THRESHOLD = 50;

export function PreviewLightbox({ images, index, onClose, onNavigate }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState<string>("50% 50%");
  const [lastIndex, setLastIndex] = useState<number | null>(index);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  if (index !== lastIndex) {
    setLastIndex(index);
    setZoomed(false);
    setZoomOrigin("50% 50%");
  }

  const open = index !== null;
  const total = images.length;

  const goPrev = useCallback(() => {
    if (index === null || total === 0) return;
    onNavigate((index - 1 + total) % total);
    setZoomed(false);
  }, [index, total, onNavigate]);

  const goNext = useCallback(() => {
    if (index === null || total === 0) return;
    onNavigate((index + 1) % total);
    setZoomed(false);
  }, [index, total, onNavigate]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || index === null) return null;
  const image = images[index];
  if (!image) return null;

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${xPct.toFixed(2)}% ${yPct.toFixed(2)}%`);
    setZoomed((z) => !z);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    touchStart.current = null;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx > 0) goPrev();
      else goNext();
    } else if (dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
      onClose();
    }
  }

  const counter = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.label ?? "Image preview"}
      className="group/lb fixed inset-0 z-[100] flex items-center justify-center bg-ink/88 backdrop-blur-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 motion-safe:ease-out"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-paper/20 bg-paper/10 text-paper transition-colors hover:bg-paper/20"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {total > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-paper/20 bg-paper/10 text-paper opacity-60 transition-all duration-300 hover:bg-paper/20 hover:opacity-100 focus-visible:opacity-100 md:left-6 md:opacity-0 md:group-hover/lb:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-paper/20 bg-paper/10 text-paper opacity-60 transition-all duration-300 hover:bg-paper/20 hover:opacity-100 focus-visible:opacity-100 md:right-6 md:opacity-0 md:group-hover/lb:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      ) : null}

      <div
        className="relative flex max-h-[90vh] max-w-[92vw] flex-col items-center justify-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[97%] motion-safe:duration-500 motion-safe:ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`relative overflow-hidden rounded-[20px] ring-1 ring-paper/30 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
          onClick={handleImageClick}
        >
          <FaceSafeImage
            key={image.url}
            src={image.url}
            alt={image.label ?? "Generated image"}
            width={2000}
            height={2000}
            focalPoint={image.focalPoint ?? undefined}
            faceBox={image.faceBox ?? undefined}
            className="block max-h-[80vh] w-auto max-w-[92vw] object-contain transition-transform duration-500 ease-out"
            style={{
              transform: zoomed ? "scale(1.5)" : "scale(1)",
              transformOrigin: zoomOrigin,
            }}
            unoptimized
          />
        </div>

        <div className="mt-5 flex w-full items-center justify-between gap-4 px-1 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/80">
          <span>
            {image.label ?? ""}
            {image.label && image.presetSlug ? " · " : ""}
            {image.presetSlug ?? ""}
          </span>
          <span>{counter}</span>
        </div>
      </div>
    </div>
  );
}
