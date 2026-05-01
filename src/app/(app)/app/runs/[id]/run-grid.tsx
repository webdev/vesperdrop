"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { CompleteLookButton } from "@/components/app/complete-look-button";
import { PackGallery } from "@/components/app/pack-gallery";

export type Generation = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  outputUrl: string | null;
  presetId: string;
  error: string | null;
  watermarked: boolean;
  quality: "preview" | "hd";
  sceneifyGenerationId: string | null;
  parentGenerationId: string | null;
  packId: string | null;
  packRole: string | null;
  packShotIndex: number | null;
};

export type Pack = {
  id: string;
  parentGenerationId: string;
  platform: "amazon" | "shopify" | "instagram" | "tiktok";
  shotCount: number;
  status: "pending" | "running" | "succeeded" | "partial" | "failed";
};

interface Props {
  runId: string;
  initial: Generation[];
  initialPacks: Pack[];
}

export function RunGrid({ runId, initial, initialPacks }: Props) {
  const [gens, setGens] = useState<Generation[]>(initial);
  const [packs, setPacks] = useState<Pack[]>(initialPacks);
  const completedTracked = useRef(false);

  useEffect(() => {
    const allDone = gens.every(
      (g) => g.status === "succeeded" || g.status === "failed",
    );
    if (allDone && !completedTracked.current) {
      completedTracked.current = true;
      const succeeded = gens.filter((g) => g.status === "succeeded").length;
      const failed = gens.filter((g) => g.status === "failed").length;
      track("run_complete", {
        run_id: runId,
        succeeded,
        failed,
        total: gens.length,
      });
    }
    if (allDone) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) return;
      const { generations, packs: nextPacks } = await res.json();
      if (Array.isArray(generations)) setGens(generations);
      if (Array.isArray(nextPacks)) setPacks(nextPacks);
    }, 2500);
    return () => clearInterval(t);
  }, [runId, gens]);

  const topLevel = useMemo(() => gens.filter((g) => !g.packId), [gens]);
  const shotsByPack = useMemo(() => {
    const map = new Map<string, Generation[]>();
    for (const g of gens) {
      if (!g.packId) continue;
      const arr = map.get(g.packId) ?? [];
      arr.push(g);
      map.set(g.packId, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.packShotIndex ?? 0) - (b.packShotIndex ?? 0));
    }
    return map;
  }, [gens]);

  function handlePackCreated(p: Pack, shots: Generation[]) {
    setPacks((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev;
      return [...prev, p];
    });
    setGens((prev) => {
      const existing = new Set(prev.map((g) => g.id));
      const additions = shots.filter((s) => !existing.has(s.id));
      return additions.length === 0 ? prev : [...prev, ...additions];
    });
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {topLevel.map((g) => (
          <Tile
            key={g.id}
            runId={runId}
            generation={g}
            onPackCreated={handlePackCreated}
          />
        ))}
      </div>

      {packs.map((p) => (
        <PackGallery
          key={p.id}
          runId={runId}
          pack={p}
          initialShots={shotsByPack.get(p.id) ?? []}
          onPackUpdate={(updated) =>
            setPacks((prev) =>
              prev.map((x) => (x.id === updated.id ? updated : x)),
            )
          }
          onShotsUpdate={(updatedShots) => {
            setGens((prev) => {
              const byId = new Map(prev.map((g) => [g.id, g]));
              for (const s of updatedShots) byId.set(s.id, s);
              return Array.from(byId.values());
            });
          }}
        />
      ))}
    </div>
  );
}

function Tile({
  runId,
  generation: g,
  onPackCreated,
}: {
  runId: string;
  generation: Generation;
  onPackCreated: (pack: Pack, shots: Generation[]) => void;
}) {
  return (
    <div className="relative aspect-square border border-zinc-200 bg-zinc-50 grid place-items-center overflow-hidden rounded-lg">
      {g.status === "succeeded" && g.outputUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={g.outputUrl}
            alt=""
            className="w-full h-full object-contain"
          />
          {g.watermarked ? (
            <>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3 flex items-end justify-between">
                <span className="font-mono text-[9px] tracking-[0.14em] text-white/80 uppercase">
                  Preview · watermarked
                </span>
                <Link
                  href="/pricing"
                  className="font-mono text-[9px] tracking-[0.14em] text-orange-400 uppercase underline-offset-4 hover:underline"
                >
                  Upgrade →
                </Link>
              </div>
              <CompleteLookButton
                runId={runId}
                parentGenerationId={g.id}
                locked
                onPackCreated={onPackCreated}
              />
            </>
          ) : (
            <>
              <div className="absolute top-2 right-2 bg-orange-500 px-2 py-0.5 font-mono text-[9px] tracking-[0.14em] text-white uppercase rounded">
                HD
              </div>
              <CompleteLookButton
                runId={runId}
                parentGenerationId={g.id}
                disabled={!g.sceneifyGenerationId}
                onPackCreated={onPackCreated}
              />
            </>
          )}
        </>
      ) : g.status === "failed" ? (
        <span className="text-xs text-orange-500 p-4 text-center">
          {g.error ?? "Generation failed"}
        </span>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
          <span className="text-xs text-zinc-500 capitalize">{g.status}</span>
        </div>
      )}
    </div>
  );
}
