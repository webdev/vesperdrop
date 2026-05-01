"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompleteLookButton } from "./complete-look-button";

interface Props {
  runId: string;
  generationId: string;
  imageUrl: string;
  downloadUrl: string;
  alt: string;
  caption: string;
  watermarked: boolean;
  hasSceneifyId: boolean;
  /** When true (the source upload) we render a simpler tile with no pack action. */
  isSource?: boolean;
  /** When true (a derivative pack shot) we hide the CompleteLookButton — already a pack member. */
  isPackShot?: boolean;
}

export function RunFigure({
  runId,
  generationId,
  imageUrl,
  downloadUrl,
  alt,
  caption,
  watermarked,
  hasSceneifyId,
  isSource,
  isPackShot,
}: Props) {
  const router = useRouter();
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomed(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoomed]);

  return (
    <figure className="space-y-2">
      <div
        className={`relative block aspect-[4/5] overflow-hidden border bg-zinc-50 group ${
          isSource ? "border-orange-500/60" : "border-zinc-200"
        }`}
      >
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="absolute inset-0 cursor-zoom-in"
          aria-label={`View ${alt} larger`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            className="w-full h-full object-contain transition-opacity group-hover:opacity-95"
          />
        </button>

        {isSource ? (
          <span className="absolute top-2 left-2 font-mono text-[9px] tracking-[0.18em] uppercase bg-orange-500 text-white px-2 py-0.5 pointer-events-none">
            Yours
          </span>
        ) : null}

        {watermarked && !isSource ? (
          <span className="absolute top-2 left-2 font-mono text-[9px] tracking-[0.18em] uppercase bg-black/70 text-white px-2 py-0.5 pointer-events-none">
            Preview
          </span>
        ) : null}

        {!isSource ? (
          <DownloadButton href={downloadUrl} ariaLabel={`Download ${alt}`} />
        ) : null}

        {!isSource && !isPackShot ? (
          <CompleteLookButton
            runId={runId}
            parentGenerationId={generationId}
            locked={watermarked}
            disabled={!watermarked && !hasSceneifyId}
            onPackCreated={() => router.push(`/app/runs/${runId}`)}
          />
        ) : null}
      </div>
      <figcaption className="font-mono text-[10px] tracking-[0.18em] uppercase text-zinc-500">
        {caption}
      </figcaption>

      {zoomed ? (
        <Lightbox
          imageUrl={imageUrl}
          downloadUrl={downloadUrl}
          alt={alt}
          isSource={isSource}
          onClose={() => setZoomed(false)}
        />
      ) : null}
    </figure>
  );
}

function DownloadButton({ href, ariaLabel }: { href: string; ariaLabel: string }) {
  return (
    <a
      href={href}
      download
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      title="Download"
      className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-zinc-700 shadow-sm transition-colors hover:bg-white hover:text-zinc-900"
    >
      <DownloadIcon />
    </a>
  );
}

function Lightbox({
  imageUrl,
  downloadUrl,
  alt,
  isSource,
  onClose,
}: {
  imageUrl: string;
  downloadUrl: string;
  alt: string;
  isSource?: boolean;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/85 p-6 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-full max-w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        />
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {!isSource ? (
            <a
              href={downloadUrl}
              download
              aria-label={`Download ${alt}`}
              title="Download"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-white/95 px-4 text-[12px] font-medium text-zinc-900 shadow-sm transition-colors hover:bg-white"
            >
              <DownloadIcon /> Download
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-sm transition-colors hover:bg-white"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
