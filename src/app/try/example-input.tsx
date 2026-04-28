/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";

type Sample = {
  slug: string;
  src: string;
  filename: string;
  size: string;
};

const SAMPLES: Sample[] = [
  {
    slug: "jacket",
    src: "/marketing/before-after/jacket_before.png",
    filename: "JKT-08_FLATLAY.JPG",
    size: "1600×1600 · 1.8MB",
  },
  {
    slug: "skirt",
    src: "/marketing/before-after/skirt_before.png",
    filename: "SKT-14_FLATLAY.JPG",
    size: "1600×1600 · 2.1MB",
  },
  {
    slug: "cami",
    src: "/marketing/before-after/cami_before.png",
    filename: "CAM-BRN-S_MANN.JPG",
    size: "1600×1600 · 1.6MB",
  },
  {
    slug: "lace",
    src: "/marketing/before-after/lace_before.png",
    filename: "BRL-RSE-M_FLAT.JPG",
    size: "1600×1600 · 1.4MB",
  },
];

const ROTATE_MS = 3500;

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
      <div className="mb-3 font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase">
        Example of a good input &rarr;
      </div>
      <div className="relative aspect-square overflow-hidden border border-[var(--color-line)] bg-[var(--color-cream)]">
        {SAMPLES.map((s, i) => (
          <img
            key={s.slug}
            src={s.src}
            alt={s.slug}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            style={{ opacity: i === idx ? 1 : 0 }}
            draggable={false}
          />
        ))}
        <div className="absolute top-3 left-3 bg-black/55 px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-[var(--color-cream)] uppercase backdrop-blur-sm">
          YOURS CAN LOOK LIKE THIS
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] tracking-[0.12em] text-[var(--color-ink-3)] uppercase">
        <span>{SAMPLES[idx].filename}</span>
        <span>{SAMPLES[idx].size}</span>
      </div>
      <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.1em] text-[var(--color-ink-3)]">
        Hanger, mannequin, flat on the floor — any angle works.
      </p>
    </div>
  );
}
