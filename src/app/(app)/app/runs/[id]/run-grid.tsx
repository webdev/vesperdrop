"use client";
import { useEffect, useState } from "react";

type Generation = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  output_url: string | null;
  preset_id: string;
  error: string | null;
};

export function RunGrid({ runId, initial }: { runId: string; initial: Generation[] }) {
  const [gens, setGens] = useState<Generation[]>(initial);
  useEffect(() => {
    const allDone = gens.every((g) => g.status === "succeeded" || g.status === "failed");
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
        <div key={g.id} className="aspect-square border border-[var(--color-line)] bg-[var(--color-paper-2)] grid place-items-center overflow-hidden">
          {g.status === "succeeded" && g.output_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.output_url} alt="" className="w-full h-full object-cover" />
          ) : g.status === "failed" ? (
            <span className="text-xs text-[var(--color-ember)] p-4">{g.error ?? "failed"}</span>
          ) : (
            <span className="text-xs text-[var(--color-ink-3)] animate-pulse">{g.status}</span>
          )}
        </div>
      ))}
    </div>
  );
}
