"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";

type Generation = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  outputUrl: string | null;
  presetId: string;
  error: string | null;
  watermarked: boolean;
  quality: "preview" | "hd";
};

export function RunGrid({ runId, initial }: { runId: string; initial: Generation[] }) {
  const [gens, setGens] = useState<Generation[]>(initial);
  const completedTracked = useRef(false);

  useEffect(() => {
    const allDone = gens.every((g) => g.status === "succeeded" || g.status === "failed");
    if (allDone && !completedTracked.current) {
      completedTracked.current = true;
      const succeeded = gens.filter((g) => g.status === "succeeded").length;
      const failed = gens.filter((g) => g.status === "failed").length;
      track("run_complete", { run_id: runId, succeeded, failed, total: gens.length });
    }
    if (allDone) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) return;
      const { generations } = await res.json();
      setGens(generations);
    }, 2500);
    return () => clearInterval(t);
  }, [runId, gens]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {gens.map((g) => (
        <div
          key={g.id}
          className="relative aspect-square border border-[var(--color-line)] bg-[var(--color-paper-2)] grid place-items-center overflow-hidden"
        >
          {g.status === "succeeded" && g.outputUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.outputUrl} alt="" className="w-full h-full object-contain" />
              {/* Watermark badge */}
              {g.watermarked ? (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3 flex items-end justify-between">
                  <span className="font-mono text-[9px] tracking-[0.14em] text-white/80 uppercase">
                    Preview · watermarked
                  </span>
                  <Link
                    href="/pricing"
                    className="font-mono text-[9px] tracking-[0.14em] text-[var(--color-ember)] uppercase underline-offset-4 hover:underline"
                  >
                    Upgrade →
                  </Link>
                </div>
              ) : (
                <div className="absolute top-2 right-2 bg-[var(--color-ember)] px-2 py-0.5 font-mono text-[9px] tracking-[0.14em] text-white uppercase">
                  HD
                </div>
              )}
            </>
          ) : g.status === "failed" ? (
            <span className="text-xs text-[var(--color-ember)] p-4 text-center">
              {g.error ?? "Generation failed"}
            </span>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-5 w-5 rounded-full border-2 border-[var(--color-ink-3)] border-t-transparent animate-spin" />
              <span className="text-xs text-[var(--color-ink-3)] capitalize">{g.status}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
