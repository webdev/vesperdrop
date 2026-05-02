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
  /** When true, the popover shows a paywall instead of the platform picker. */
  locked?: boolean;
  onPackCreated: (pack: Pack, shots: Generation[]) => void;
}

export function CompleteLookButton({
  runId,
  parentGenerationId,
  disabled,
  locked,
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
    <div className="absolute left-2 top-2 z-10">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          if (!open) {
            track("complete_look_clicked", {
              parent_id: parentGenerationId,
              locked: locked ?? false,
            });
          }
        }}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] shadow-subtle transition-colors ${
          disabled
            ? "cursor-not-allowed bg-cream/95 text-ink opacity-50"
            : locked
              ? "bg-ink/90 text-cream hover:bg-ink"
              : "bg-cream/95 text-ink hover:bg-cream"
        }`}
        title={
          disabled
            ? "Complete the look isn't available for this image"
            : locked
              ? "Complete the look · Pro feature"
              : "Generate a full marketplace pack from this shot"
        }
      >
        Complete the look <span aria-hidden>→</span>
      </button>

      {open && locked ? (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-20 mt-2 w-[300px] rounded-xl border border-line bg-surface p-4 shadow-card"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-terracotta">
            Pro feature
          </p>
          <h3 className="mt-2 font-serif text-[18px] leading-[1.2] text-ink">
            Get the full marketplace pack
          </h3>
          <p className="mt-2 text-[13px] leading-[1.5] text-ink-3">
            Subscribe to generate 3–6 coordinated shots from any HD image —
            ready for Amazon, Shopify, Instagram, or TikTok.
          </p>
          <ul className="mt-3 space-y-1.5 text-[12px] text-ink-2">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-terracotta" />
              Hero, lifestyle, and detail crops at platform-native sizes
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-terracotta" />
              Color and styling matched to your hero shot
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-terracotta" />
              No watermark, full resolution
            </li>
          </ul>
          <Link
            href="/pricing"
            onClick={() =>
              track("paywall_upgrade_clicked", {
                feature: "complete_look",
                parent_id: parentGenerationId,
              })
            }
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
          >
            See plans <span aria-hidden>→</span>
          </Link>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
            Pro from $49/mo · 200 credits · cancel any time
          </p>
        </div>
      ) : null}

      {open && !locked ? (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-20 mt-2 w-[280px] rounded-xl border border-line bg-surface p-3 shadow-card"
        >
          <p className="px-1 pb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
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
                      ? "bg-paper-2"
                      : "hover:bg-paper-soft disabled:opacity-50 disabled:hover:bg-transparent"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink">
                      {p.label}
                    </div>
                    <div className="text-[11px] text-ink-3">{p.hint}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[12px] font-medium text-ink tabular-nums">
                      {p.shots} credits
                    </div>
                    <div className="text-[10px] text-ink-3">{p.shots} shots</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {error ? (
            <div className="mt-3 rounded-lg border border-terracotta/30 bg-terracotta-wash px-3 py-2 text-[12px] text-terracotta-dark">
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
    sceneifySourceId:
      (r.sceneifySourceId as string | null) ??
      (r.sceneify_source_id as string | null) ??
      null,
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
