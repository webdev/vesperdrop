"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import type { Generation, Pack } from "@/app/(app)/app/runs/[id]/run-grid";

const PLATFORMS = [
  { id: "amazon",    label: "Amazon Apparel",  shots: 6, hint: "1 main + 3 lifestyle + 2 detail" },
  { id: "shopify",   label: "Shopify lookbook", shots: 4, hint: "1 hero + 3 supporting" },
  { id: "instagram", label: "Instagram set",    shots: 5, hint: "1:1 carousel" },
  { id: "tiktok",    label: "TikTok Reels",     shots: 3, hint: "9:16 vertical" },
] as const;

type PlatformId = (typeof PLATFORMS)[number]["id"];

interface Props {
  runId: string;
  parentGenerationId: string;
  disabled?: boolean;
  onPackCreated: (pack: Pack, shots: Generation[]) => void;
}

export function CompleteLookButton({
  runId,
  parentGenerationId,
  disabled,
  onPackCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<PlatformId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setError(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setError(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSubmit(platform: PlatformId) {
    if (submitting) return;
    setSubmitting(platform);
    setError(null);
    track("complete_look_submitted", { platform, parent_id: parentGenerationId });
    try {
      const res = await fetch(`/api/runs/${runId}/complete-look`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentGenerationId, platform }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 402) {
          setError(`You need ${json?.required ?? "more"} credits for this pack.`);
          setSubmitting(null);
          return;
        }
        setError(json?.error ?? `Request failed (${res.status})`);
        setSubmitting(null);
        return;
      }
      const pack = mapPack(json.pack);
      const shots = (json.shots ?? []).map(mapShot);
      onPackCreated(pack, shots);
      setOpen(false);
      setSubmitting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(null);
    }
  }

  return (
    <div className="absolute top-2 left-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          if (!open) {
            track("complete_look_clicked", { parent_id: parentGenerationId });
          }
        }}
        className={`inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium tracking-tight text-zinc-900 shadow-sm transition-colors ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-white hover:shadow"
        }`}
        title={
          disabled
            ? "Complete the look isn't available for this image"
            : "Generate a full marketplace pack from this shot"
        }
      >
        Complete the look <span aria-hidden>→</span>
      </button>

      {open ? (
        <div
          ref={popoverRef}
          className="absolute top-full mt-2 left-0 z-20 w-[280px] rounded-xl border border-zinc-200 bg-white p-3 shadow-lg"
        >
          <p className="px-1 pb-2 text-[11px] font-medium tracking-[0.16em] text-zinc-500 uppercase">
            Generate marketplace pack
          </p>
          <ul className="space-y-1">
            {PLATFORMS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => handleSubmit(p.id)}
                  disabled={Boolean(submitting)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    submitting === p.id
                      ? "bg-zinc-100"
                      : "hover:bg-zinc-50 disabled:opacity-50 disabled:hover:bg-transparent"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-zinc-900">
                      {p.label}
                    </div>
                    <div className="text-[11px] text-zinc-500">{p.hint}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[12px] font-medium text-zinc-900 tabular-nums">
                      {p.shots} credits
                    </div>
                    <div className="text-[10px] text-zinc-500">{p.shots} shots</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {error ? (
            <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] text-orange-700">
              {error}
              {error.includes("credits") ? (
                <>
                  {" "}
                  <Link href="/pricing" className="underline">
                    Upgrade →
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
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
