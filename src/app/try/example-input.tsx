/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

type Sample = {
  slug: string;
  src: string;
  filename: string;
  size: string;
  name: string;
  qualifier: string;
};

const SAMPLES: Sample[] = [
  {
    slug: "jacket",
    src: "/marketing/before-after/jacket_before.png",
    filename: "JKT-08_FLATLAY.JPG",
    size: "1600×1600 · 1.8MB",
    name: "Hanger",
    qualifier: "Clean & front-facing",
  },
  {
    slug: "skirt",
    src: "/marketing/before-after/skirt_before.png",
    filename: "SKT-14_FLATLAY.JPG",
    size: "1600×1600 · 2.1MB",
    name: "Flat surface",
    qualifier: "Well-lit & clear",
  },
  {
    slug: "cami",
    src: "/marketing/before-after/cami_before.png",
    filename: "CAM-BRN-S_MANN.JPG",
    size: "1600×1600 · 1.6MB",
    name: "Any angle",
    qualifier: "Real & uncluttered",
  },
  {
    slug: "lace",
    src: "/marketing/before-after/lace_before.png",
    filename: "BRL-RSE-M_FLAT.JPG",
    size: "1600×1600 · 1.4MB",
    name: "Real",
    qualifier: "Real-world photo",
  },
];

const ROTATE_MS = 3500;

// Mobile: horizontal-scroll snap row of sample cards with checkmark badges
// and a name + qualifier subtitle. The 4th card peeks off-screen at 390px to
// signal scrollability. Desktop keeps the original rotating single-image hero.
export function ExampleInput({ paused }: { paused: boolean }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % SAMPLES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [paused]);

  return (
    <div>
      {/* Mobile: editorial section header with caret accent */}
      <div className="mb-3 flex items-center gap-2 md:hidden">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          Example of a good input
        </p>
        <ChevronDown
          aria-hidden
          className="h-3.5 w-3.5 text-ink-4"
          strokeWidth={1.75}
        />
      </div>

      {/* Mobile horizontal scroller */}
      <div className="-mx-5 md:hidden">
        <div
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Example product inputs"
        >
          {SAMPLES.map((s) => (
            <div
              key={s.slug}
              className="snap-start"
              style={{ minWidth: "150px", width: "150px" }}
            >
              <div className="relative aspect-square overflow-hidden rounded-lg border border-line-soft bg-paper-2">
                <img
                  src={s.src}
                  alt={s.name}
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
                <div
                  aria-hidden
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-cream shadow-subtle"
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-ink"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
              </div>
              <p className="mt-2 text-[13px] font-medium leading-tight text-ink">
                {s.name}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-ink-3">
                {s.qualifier}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: keep the existing rotating single-image hero */}
      <div className="hidden md:block">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 md:mb-3">
          Example of a good input →
        </p>
        <div className="relative aspect-square overflow-hidden rounded-lg border border-line-soft bg-paper-2">
          {SAMPLES.map((s, i) => (
            <img
              key={s.slug}
              src={s.src}
              alt={s.slug}
              className="absolute inset-0 h-full w-full object-contain transition-opacity duration-700"
              style={{ opacity: i === idx ? 1 : 0 }}
              draggable={false}
            />
          ))}
          <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-cream/95 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink shadow-subtle">
            Yours can look like this
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4 md:mt-3">
          <span>{SAMPLES[idx]!.filename}</span>
          <span>{SAMPLES[idx]!.size}</span>
        </div>
        <p className="mt-2 text-[13px] leading-[1.5] text-ink-3 md:mt-3 md:text-[14px] md:leading-[1.55]">
          Hanger, mannequin, flat on the floor — any angle works.
        </p>
      </div>
    </div>
  );
}
