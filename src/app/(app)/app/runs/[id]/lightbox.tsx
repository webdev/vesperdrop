"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pill } from "@/components/ui/pill";

type Props = {
  generationId: string;
  imageUrl: string;
  sceneName: string;
  watermarked: boolean;
  sourceUrl: string | null;
  dateLabel: string;
  onClose: () => void;
};

export function Lightbox({
  generationId,
  imageUrl,
  sceneName,
  watermarked,
  sourceUrl,
  dateLabel,
  onClose,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${sceneName} image detail`}
      className="fixed inset-0 z-50 flex items-stretch bg-ink/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-5 top-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 font-mono text-[14px] text-white transition-colors hover:bg-white/10"
      >
        <span aria-hidden>×</span>
      </button>

      <div
        className="m-auto flex h-full w-full max-w-[1280px] flex-col gap-6 p-6 md:flex-row md:items-stretch md:gap-10 md:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image side */}
        <div className="relative flex-1 self-stretch overflow-hidden rounded-xl bg-black/30 md:flex-[3]">
          <Image
            src={imageUrl}
            alt={sceneName}
            fill
            sizes="(max-width: 1024px) 100vw, 70vw"
            unoptimized
            className="object-contain"
          />
        </div>

        {/* Meta side */}
        <aside className="flex flex-col gap-6 text-cream md:w-[280px] md:flex-none md:py-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">
              {dateLabel}
            </p>
            <h2 className="mt-2 font-serif text-[clamp(1.625rem,2.4vw,2rem)] leading-[1.1] tracking-[-0.01em] text-cream">
              {sceneName}
            </h2>
            <div className="mt-3">
              {watermarked ? (
                <Pill tone="accent" className="tracking-[0.12em]">
                  Preview · watermarked
                </Pill>
              ) : (
                <Pill tone="ink" className="border-white/20 bg-white/10 text-cream tracking-[0.12em]">
                  HD · full resolution
                </Pill>
              )}
            </div>
          </div>

          {sourceUrl ? (
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">
                Original
              </p>
              <div className="relative aspect-[4/5] w-32 overflow-hidden rounded-md border border-white/15 bg-white/5">
                <Image
                  src={sourceUrl}
                  alt="Source product photo"
                  fill
                  sizes="128px"
                  unoptimized
                  className="object-cover"
                />
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex flex-col gap-2.5">
            <a
              href={`/api/images/${generationId}?download=1`}
              download
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cream px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-white"
            >
              Download
            </a>
            <Link
              href="/try"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-transparent px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-white/10"
            >
              Use this style again
            </Link>
            {watermarked ? (
              <Link
                href="/pricing"
                className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta-soft transition-colors hover:text-cream"
              >
                Upgrade to remove watermark →
              </Link>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
