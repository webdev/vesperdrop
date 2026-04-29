"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { useProgressBatch } from "@/lib/progress/use-progress-batch";
import { filmstripFor } from "@/lib/progress/filmstrip-fallback";

type Props = {
  file: File;
  sceneSlugs: string[];
  userPhotoUrl: string;
  onAllDone: (results: Array<{ slug: string; outputUrl: string }>) => void;
  onFatal: (message: string) => void;
};

export function ProgressScreen({ file, sceneSlugs, userPhotoUrl, onAllDone, onFatal }: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableSlugs = useMemo(() => sceneSlugs, []); // contract: stable for lifetime
  const view = useProgressBatch({ file, sceneSlugs: stableSlugs });

  useEffect(() => {
    if (view.allDone) {
      const results = stableSlugs
        .map((slug) => {
          const url = view.streams[slug]?.outputUrl;
          return url ? { slug, outputUrl: url } : null;
        })
        .filter((x): x is { slug: string; outputUrl: string } => x !== null);
      onAllDone(results);
    } else if (view.allFailed) {
      const firstError = stableSlugs
        .map((slug) => view.streams[slug]?.error?.message)
        .find(Boolean) ?? "Generation failed";
      onFatal(firstError);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.allDone, view.allFailed]);

  const filmstrip = filmstripFor(view.primaryPreset?.category);
  const palette = view.primaryPreset?.palette ?? ["#cfcabf", "#766c57"];

  return (
    <div className="flex flex-col gap-8 items-center">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center w-full max-w-3xl">
        <div className="relative aspect-square w-full max-w-[360px] mx-auto overflow-hidden rounded-lg bg-neutral-100">
          <Image
            src={userPhotoUrl}
            alt="your upload"
            fill
            sizes="360px"
            className="object-cover saturate-95"
            style={{ animation: "vd-zoom 12s ease-out infinite alternate" }}
          />
          <div
            className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><rect width='2' height='2' fill='%23000' opacity='0.06'/></svg>\")",
            }}
          />
        </div>

        <div className="flex flex-row gap-2 justify-center">
          {filmstrip.map((src, i) => {
            const isActive = view.isHighlightingFilmstrip && i === view.filmstripIndex;
            return (
              <div
                key={src}
                className="relative w-16 h-16 rounded-md overflow-hidden transition-all duration-250 ease-out"
                style={{
                  opacity: isActive ? 1 : 0.35,
                  filter: isActive ? "grayscale(0)" : "grayscale(60%)",
                  boxShadow: isActive ? `0 0 0 2px ${palette[0]}` : "none",
                  transform: isActive ? "scale(1.05)" : "scale(1)",
                }}
              >
                <Image src={src} alt="" fill sizes="64px" className="object-cover" />
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-7 text-center text-sm text-neutral-700 transition-opacity duration-350" key={view.currentLine}>
        {view.currentLine || "Getting things ready…"}
      </div>

      <div
        className="w-full max-w-3xl h-1 rounded-full overflow-hidden bg-neutral-100"
        aria-hidden
      >
        <div
          className="h-full"
          style={{
            backgroundImage: `linear-gradient(90deg, ${palette[0]} 0%, ${palette[1]} 50%, ${palette[0]} 100%)`,
            backgroundSize: "200% 100%",
            animation: "vd-sweep 8s linear infinite",
          }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 w-full max-w-3xl">
        {stableSlugs.map((slug) => {
          const s = view.streams[slug];
          if (s?.outputUrl) {
            return (
              <div key={slug} className="relative aspect-square overflow-hidden rounded-md bg-neutral-100">
                <Image src={s.outputUrl} alt={slug} fill sizes="200px" className="object-cover" />
              </div>
            );
          }
          if (s?.error) {
            return (
              <div
                key={slug}
                className="aspect-square rounded-md bg-neutral-100 flex flex-col items-center justify-center gap-2 text-xs text-neutral-600 p-2 text-center"
              >
                <span>could not render</span>
                {s.error.retryable && (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => s.retry()}
                  >
                    retry
                  </button>
                )}
              </div>
            );
          }
          return (
            <div
              key={slug}
              className="aspect-square rounded-md bg-neutral-100 animate-pulse"
              aria-label={`generating ${slug}`}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes vd-zoom { from { transform: scale(1); } to { transform: scale(1.04); } }
        @keyframes vd-sweep { from { background-position: 0% 0; } to { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
