"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Generation, SceneInfo } from "@/app/(app)/app/runs/[id]/run-grid";

// What's actually real here:
//
// Sceneify itself does NOT emit incremental progress — generateViaSceneify is a
// single HTTP call that returns a finished result. The only generation states
// available are the four we persist on the `generations` row: pending | running |
// succeeded | failed, with createdAt/completedAt timestamps. Everything in this
// panel is computed from those real fields:
//
//  - Overall % = done / total
//  - Per-image elapsed / "done in Ns" = completedAt - createdAt
//  - Est. remaining = avg of completed durations × items left (omitted if no
//    completed items yet — we never invent an ETA)
//
// The only cosmetic embellishment is the rotating UX copy below "Generating",
// "Preparing scene", etc. — those are a varied label set keyed off the REAL
// status. They never advance the row's actual state and never show up unless
// the row is genuinely in that status.

interface Props {
  generations: Generation[];
  scenes: SceneInfo[];
  /** Optional: when omitted, panel manages its own minimized state. */
  defaultMinimized?: boolean;
}

const RUNNING_PHRASES = [
  "Generating",
  "Crafting",
  "Composing",
  "Rendering",
] as const;

const PENDING_PHRASES = [
  "Queued",
  "Waiting in line",
  "Up next",
] as const;

const RUNNING_SUBLABELS = [
  "Composing elements",
  "Lighting & texture",
  "Color matching",
  "Enhancing details",
] as const;

const PENDING_SUBLABELS = [
  "Waiting to start",
  "Preparing the scene",
] as const;

const TILE_PLACEHOLDER_HINT = "Almost there";

export function GenerationProgressPanel({
  generations,
  scenes,
  defaultMinimized = false,
}: Props) {
  const sceneNameBySlug = useMemo(
    () => new Map(scenes.map((s) => [s.slug, s.name])),
    [scenes],
  );

  // Filter to top-level (non-pack) generations — pack shots have their own UI.
  const items = useMemo(
    () => generations.filter((g) => !g.packId),
    [generations],
  );

  const total = items.length;
  const succeeded = items.filter((g) => g.status === "succeeded").length;
  const failed = items.filter((g) => g.status === "failed").length;
  const running = items.filter((g) => g.status === "running").length;
  const queued = items.filter((g) => g.status === "pending").length;
  const done = succeeded + failed;
  const allDone = total > 0 && done === total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Real ETA from completed durations only. Omit if nothing's completed yet.
  const avgDurationSec = useMemo(() => {
    const completed = items
      .filter((g) => g.status === "succeeded" && g.createdAt && g.completedAt)
      .map(
        (g) =>
          (new Date(g.completedAt!).getTime() -
            new Date(g.createdAt!).getTime()) /
          1000,
      )
      .filter((s) => s > 0 && Number.isFinite(s));
    if (completed.length === 0) return null;
    return completed.reduce((a, b) => a + b, 0) / completed.length;
  }, [items]);

  const remainingItems = total - done;
  const etaSec =
    avgDurationSec !== null && remainingItems > 0
      ? Math.max(1, Math.round(avgDurationSec * remainingItems))
      : null;

  // Cosmetic flicker tick — only advances while there's at least one running
  // or pending row. Drives copy variation, never state.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (allDone) return;
    const t = setInterval(() => setTick((v) => v + 1), 2200);
    return () => clearInterval(t);
  }, [allDone]);

  const [minimized, setMinimized] = useState(defaultMinimized);

  if (total === 0 || allDone) return null;

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <header className="max-w-[560px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
            Generation progress
          </p>
          <h2 className="mt-3 font-serif text-[clamp(2.25rem,4vw,3.25rem)] leading-[1.02] tracking-[-0.02em] text-ink">
            Creating your images
          </h2>
          <p className="mt-3 max-w-[460px] text-[15px] leading-[1.55] text-ink-3">
            We&rsquo;re crafting beautiful lifestyle photos for your selected
            scenes. This usually takes about a minute.
          </p>
          <FeaturePills />
        </header>

        <SummaryCard
          pct={pct}
          done={done}
          total={total}
          etaSec={etaSec}
        />
      </div>

      <div className="rounded-2xl border border-line-soft bg-paper-soft/60 p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[12px] tracking-[0.04em] text-ink-2">
            <span className="text-ink">Generating {total} {total === 1 ? "image" : "images"}</span>
            <span className="mx-2 text-ink-4">·</span>
            <span className="text-ink-3">This may take up to 1 minute</span>
          </p>
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink"
          >
            {minimized ? "Show" : "Minimize"}
            <span aria-hidden className="text-[9px]">
              {minimized ? "▾" : "▴"}
            </span>
          </button>
        </div>

        {minimized ? (
          <MinimizedBar pct={pct} done={done} total={total} etaSec={etaSec} />
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {items.map((g) => (
                <TileCard
                  key={g.id}
                  generation={g}
                  sceneName={sceneNameBySlug.get(g.presetId) ?? g.presetId}
                  tick={tick}
                />
              ))}
            </div>

            {running > 0 || queued > 0 ? (
              <div className="mt-5 rounded-xl bg-terracotta-wash/70 px-4 py-3">
                <p className="text-center text-[13px] leading-[1.5] text-ink-2">
                  <span className="mr-2 text-terracotta" aria-hidden>
                    ✦
                  </span>
                  {running > 0
                    ? "Sit tight — we're adding the finishing touches to make every image perfect."
                    : `${queued} ${queued === 1 ? "scene is" : "scenes are"} queued and starting soon.`}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function FeaturePills() {
  return (
    <ul className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 text-[12px] text-ink-3">
      <li className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line-soft bg-surface text-[12px] text-ink-3"
        >
          ◇
        </span>
        <span>
          <span className="block text-ink">High quality</span>
          <span className="block text-[11px] text-ink-4">2000px · HD</span>
        </span>
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line-soft bg-surface text-[12px] text-terracotta"
        >
          ✦
        </span>
        <span>
          <span className="block text-ink">AI enhanced</span>
          <span className="block text-[11px] text-ink-4">Lighting · Colors · Details</span>
        </span>
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line-soft bg-surface text-[12px] text-ink-3"
        >
          ✶
        </span>
        <span>
          <span className="block text-ink">Safe & private</span>
          <span className="block text-[11px] text-ink-4">Your images are never shared</span>
        </span>
      </li>
    </ul>
  );
}

function SummaryCard({
  pct,
  done,
  total,
  etaSec,
}: {
  pct: number;
  done: number;
  total: number;
  etaSec: number | null;
}) {
  return (
    <aside className="w-full max-w-[420px] rounded-2xl border border-line-soft bg-surface p-5 shadow-subtle">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-terracotta-wash text-[14px] text-terracotta"
          >
            ✦
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              Overall progress
            </p>
            <p className="mt-1 font-serif text-[36px] leading-[1] text-terracotta tabular-nums">
              {pct}%
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
            {done} / {total} completed
          </p>
          {etaSec !== null ? (
            <p className="mt-1 text-[12px] text-ink-4">
              Est. {formatSeconds(etaSec)} remaining
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-ink-4">Estimating&hellip;</p>
          )}
        </div>
      </div>
      <ProgressBar pct={pct} className="mt-4" />
    </aside>
  );
}

function MinimizedBar({
  pct,
  done,
  total,
  etaSec,
}: {
  pct: number;
  done: number;
  total: number;
  etaSec: number | null;
}) {
  return (
    <div className="mt-4">
      <p className="font-mono text-[12px] text-ink-3">
        {done} / {total} completed
        {etaSec !== null ? (
          <>
            <span className="mx-2 text-ink-4">·</span>
            {formatSeconds(etaSec)} remaining
          </>
        ) : null}
      </p>
      <ProgressBar pct={pct} className="mt-2" />
      <p className="mt-3 text-center text-[11px] text-ink-4">
        Click to expand and view all progress
      </p>
    </div>
  );
}

function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div
      className={`relative h-1.5 w-full overflow-hidden rounded-full bg-line-soft ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-terracotta transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function TileCard({
  generation: g,
  sceneName,
  tick,
}: {
  generation: Generation;
  sceneName: string;
  tick: number;
}) {
  const elapsedSec = useDoneDurationSec(g);

  return (
    <article className="overflow-hidden rounded-xl border border-line-soft bg-surface">
      <div className="border-b border-line-soft px-3 py-2">
        <p className="truncate text-[12px] font-medium text-ink">{sceneName}</p>
      </div>

      <TilePreview generation={g} />

      <div className="flex items-start gap-2 px-3 py-3">
        <StatusIcon status={g.status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-ink">
            {primaryLabel(g, tick)}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-ink-3">
            {secondaryLabel(g, tick, elapsedSec)}
          </p>
        </div>
      </div>
    </article>
  );
}

function TilePreview({ generation: g }: { generation: Generation }) {
  if (g.status === "succeeded" && g.outputUrl) {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-paper-2">
        <Image
          src={`/api/images/${g.id}`}
          alt={`Generated ${g.presetId}`}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover"
        />
      </div>
    );
  }

  if (g.status === "failed") {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center bg-paper-2">
        <span aria-hidden className="text-[28px] text-terracotta/60">
          ⊘
        </span>
      </div>
    );
  }

  // Running / pending — blurred shimmer placeholder. No fake preview.
  const isRunning = g.status === "running";
  return (
    <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-paper-2 to-paper-soft">
      <div
        aria-hidden
        className={
          isRunning
            ? "h-10 w-10 animate-spin rounded-full border-2 border-dashed border-terracotta/60 border-t-terracotta"
            : "h-10 w-10 rounded-full border-2 border-dashed border-ink-4/40"
        }
      />
      {isRunning ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.45),transparent_55%)]"
        />
      ) : null}
      {isRunning ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-3 text-[14px] text-terracotta/80 motion-safe:animate-pulse"
        >
          ✦
        </span>
      ) : null}
    </div>
  );
}

function StatusIcon({ status }: { status: Generation["status"] }) {
  if (status === "succeeded") {
    return (
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink-3 text-[9px] text-ink-2"
      >
        ✓
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-terracotta text-[9px] text-terracotta"
      >
        !
      </span>
    );
  }
  if (status === "running") {
    return (
      <span
        aria-hidden
        className="mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-terracotta/40 border-t-terracotta"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-ink-4/60"
    />
  );
}

function primaryLabel(g: Generation, tick: number): string {
  if (g.status === "succeeded") return "Completed";
  if (g.status === "failed") return "Failed";
  if (g.status === "running") {
    return RUNNING_PHRASES[tick % RUNNING_PHRASES.length]!;
  }
  return PENDING_PHRASES[tick % PENDING_PHRASES.length]!;
}

function secondaryLabel(
  g: Generation,
  tick: number,
  elapsedSec: number | null,
): string {
  if (g.status === "succeeded") {
    return elapsedSec !== null
      ? `Done in ${formatSeconds(elapsedSec)}`
      : "Done";
  }
  if (g.status === "failed") {
    return g.error?.slice(0, 60) ?? "Generation failed";
  }
  if (g.status === "running") {
    return RUNNING_SUBLABELS[tick % RUNNING_SUBLABELS.length]!;
  }
  return PENDING_SUBLABELS[tick % PENDING_SUBLABELS.length] ?? TILE_PLACEHOLDER_HINT;
}

function useDoneDurationSec(g: Generation): number | null {
  return useMemo(() => {
    if (g.status !== "succeeded" || !g.createdAt || !g.completedAt) return null;
    const ms =
      new Date(g.completedAt).getTime() - new Date(g.createdAt).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return ms / 1000;
  }, [g.status, g.createdAt, g.completedAt]);
}

function formatSeconds(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

