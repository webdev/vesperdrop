"use client";
import { useEffect, useRef } from "react";
import type { Generation, Pack } from "@/app/(app)/app/runs/[id]/run-grid";

const PLATFORM_LABELS: Record<Pack["platform"], string> = {
  amazon: "Amazon Apparel",
  shopify: "Shopify lookbook",
  instagram: "Instagram set",
  tiktok: "TikTok Reels",
};

interface Props {
  runId: string;
  pack: Pack;
  initialShots: Generation[];
  onPackUpdate: (pack: Pack) => void;
  onShotsUpdate: (shots: Generation[]) => void;
}

export function PackGallery({
  runId,
  pack,
  initialShots: shots,
  onPackUpdate,
  onShotsUpdate,
}: Props) {
  const lastReportedStatus = useRef<Pack["status"]>(pack.status);

  useEffect(() => {
    const allDone = shots.every(
      (s) => s.status === "succeeded" || s.status === "failed",
    );
    const knowsAllShots = shots.length === pack.shotCount;
    if (allDone && knowsAllShots) return;

    const t = setInterval(async () => {
      const res = await fetch(
        `/api/runs/${runId}/complete-look/${pack.id}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = await res.json();
      const nextShots = (json.shots ?? []).map(mapShot);
      onShotsUpdate(nextShots);
      const nextPack = mapPack(json.pack);
      if (nextPack.status !== lastReportedStatus.current) {
        lastReportedStatus.current = nextPack.status;
        onPackUpdate(nextPack);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [runId, pack.id, pack.shotCount, shots, onPackUpdate, onShotsUpdate]);

  const succeeded = shots.filter((s) => s.status === "succeeded").length;
  const failed = shots.filter((s) => s.status === "failed").length;
  const total = pack.shotCount;
  const allTerminal = succeeded + failed === total && shots.length === total;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-2">
        <div className="flex items-baseline gap-2">
          <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
            {PLATFORM_LABELS[pack.platform]} pack
          </p>
          <span className="text-[11px] text-zinc-400">
            · {succeeded}/{total} ready{failed > 0 ? ` · ${failed} failed` : ""}
          </span>
        </div>
        {!allTerminal ? (
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <div className="h-3 w-3 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
            <span>Generating…</span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: total }).map((_, i) => {
          const shot = shots.find((s) => (s.packShotIndex ?? -1) === i);
          return <PackTile key={i} index={i} shot={shot} />;
        })}
      </div>
    </section>
  );
}

function PackTile({ shot, index }: { shot: Generation | undefined; index: number }) {
  return (
    <div className="relative aspect-square border border-zinc-200 bg-zinc-50 grid place-items-center overflow-hidden rounded-lg">
      {shot?.status === "succeeded" && shot.outputUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shot.outputUrl}
            alt={shot.packRole ?? `Shot ${index + 1}`}
            className="w-full h-full object-contain"
          />
          {shot.packRole ? (
            <span className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-0.5 text-[10px] font-medium tracking-tight text-zinc-700">
              {shot.packRole}
            </span>
          ) : null}
        </>
      ) : shot?.status === "failed" ? (
        <span className="text-xs text-orange-500 p-4 text-center">
          {shot.error ?? "Shot failed"}
        </span>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
          <span className="text-xs text-zinc-500 capitalize">
            {shot?.status ?? "pending"}
          </span>
        </div>
      )}
    </div>
  );
}

function mapPack(raw: unknown): Pack {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id),
    parentGenerationId: String(r.parentGenerationId ?? r.parent_generation_id),
    platform: r.platform as Pack["platform"],
    shotCount: Number(r.shotCount ?? r.shot_count),
    status: (r.status as Pack["status"]) ?? "pending",
  };
}

function mapShot(raw: unknown): Generation {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id),
    status: (r.status as Generation["status"]) ?? "pending",
    outputUrl: (r.outputUrl as string | null) ?? (r.output_url as string | null) ?? null,
    presetId: String(r.presetId ?? r.preset_id),
    error: (r.error as string | null) ?? null,
    watermarked: Boolean(r.watermarked),
    quality: (r.quality as Generation["quality"]) ?? "hd",
    sceneifyGenerationId:
      (r.sceneifyGenerationId as string | null) ??
      (r.sceneify_generation_id as string | null) ??
      null,
    parentGenerationId:
      (r.parentGenerationId as string | null) ??
      (r.parent_generation_id as string | null) ??
      null,
    packId: (r.packId as string | null) ?? (r.pack_id as string | null) ?? null,
    packRole: (r.packRole as string | null) ?? (r.pack_role as string | null) ?? null,
    packShotIndex:
      (r.packShotIndex as number | null) ??
      (r.pack_shot_index as number | null) ??
      null,
  };
}
