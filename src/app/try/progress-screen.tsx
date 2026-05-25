"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProgressBatch } from "@/lib/progress/use-progress-batch";
import { deriveStudioProgress } from "@/lib/progress/studio-progress";
import { track } from "@/lib/analytics";
import type { PresetMeta } from "@/lib/progress/strings";
import type { FocalPoint, FaceBox } from "@/lib/ai/sceneify";
import { DevelopGrid, type DevelopGridVariant, type TileResult } from "./develop-grid";
import { StudioDevelopFrame } from "./studio-frame";

type StudioRenderArgs = {
  /** Optional override for the rail product image (falls back to userPhotoUrl). */
  sourceUrl?: string;
  sourceName?: string;
  sceneNames: string[];
};

type Props = {
  file: File;
  sceneSlugs: string[];
  userPhotoUrl: string;
  primaryPreset: PresetMeta;
  presetMetaBySlug: Record<string, PresetMeta>;
  variant: DevelopGridVariant;
  initialResults: TileResult[];
  onSourceUrl?: (url: string) => void;
  onSettled: (
    results: Array<{
      slug: string;
      outputUrl?: string;
      rawUrl?: string;
      focalPoint?: FocalPoint | null;
      faceBox?: FaceBox | null;
      error?: string;
      errorCode?: string;
    }>,
  ) => void;
  onDownloadClick?: (slug: string) => void;
  onUnlockClick?: () => void;
  editorial?: boolean;
  freePreviewUnlocked?: boolean;
  /**
   * When set, renders the "In the studio." StudioDevelopFrame instead of
   * the legacy DevelopGrid. The streaming hook still runs unchanged — only
   * the presentation swaps. Used by the develop step's pending state to
   * deliver the editorial multi-image layout.
   */
  studio?: StudioRenderArgs;
  /** Casting race for the whole batch — passed to every stream so all
   *  tiles share one model identity. Vesperdrop picks this once at
   *  DevelopStep mount; sceneify filters its reference pool by it. */
  castingRace?: string;
};

export function ProgressScreen({
  file,
  sceneSlugs,
  userPhotoUrl,
  primaryPreset,
  presetMetaBySlug,
  variant,
  initialResults,
  onSourceUrl,
  onSettled,
  onDownloadClick,
  onUnlockClick,
  editorial = false,
  freePreviewUnlocked = false,
  studio,
  castingRace,
}: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableSlugs = useMemo(() => sceneSlugs, []); // contract: stable for lifetime
  const view = useProgressBatch({
    file,
    sceneSlugs: stableSlugs,
    primaryPreset,
    castingRace,
  });

  const [batchId] = useState<string>(() => crypto.randomUUID());
  const batchStartRef = useRef<number>(0);

  useEffect(() => {
    batchStartRef.current = Date.now();
    track("try_batch_started", { batchId, slugs: stableSlugs });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        track("try_batch_abandoned", {
          batchId,
          elapsedMs: Date.now() - batchStartRef.current,
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sourceUrlReportedRef = useRef(false);
  useEffect(() => {
    if (sourceUrlReportedRef.current || !onSourceUrl) return;
    for (const slug of stableSlugs) {
      const url = view.streams[slug]?.sourceUrl;
      if (url) {
        sourceUrlReportedRef.current = true;
        onSourceUrl(url);
        break;
      }
    }
  }, [view.streams, stableSlugs, onSourceUrl]);

  const settledRef = useRef(false);
  useEffect(() => {
    if (settledRef.current) return;
    const allSettled = stableSlugs.every((slug) => {
      const s = view.streams[slug];
      return s?.status === "done" || s?.status === "error";
    });
    if (!allSettled) return;
    settledRef.current = true;
    const errorCount = stableSlugs.filter((slug) => view.streams[slug]?.status === "error").length;
    const doneCount = stableSlugs.length - errorCount;
    track("try_batch_completed", {
      batchId,
      doneCount,
      errorCount,
      totalMs: Date.now() - batchStartRef.current,
    });
    const out = stableSlugs.map((slug) => {
      const s = view.streams[slug];
      if (s?.outputUrl) {
        return {
          slug,
          outputUrl: s.outputUrl,
          rawUrl: s.rawUrl ?? undefined,
          focalPoint: s.focalPoint,
          faceBox: s.faceBox,
        };
      }
      return {
        slug,
        error: s?.error?.message ?? "generation failed",
        errorCode: s?.error?.code,
      };
    });
    onSettled(out);
  }, [view.streams, stableSlugs, onSettled, batchId]);

  // Augment the results with live-stream context so each tile renders the
  // rotating, slot-filled caption from streaming events. Funnel flags
  // (isFreePreview, isBonus, softLocked) are carried through from the
  // initial result snapshot so they survive the streaming → done
  // transition without being overwritten.
  const liveResults: TileResult[] = stableSlugs.map((slug) => {
    const base = initialResults.find((r) => r.sceneSlug === slug) ?? {
      sceneSlug: slug,
      sceneName: presetMetaBySlug[slug]?.name ?? slug,
      status: "pending" as const,
    };
    const s = view.streams[slug];
    if (s?.outputUrl) {
      return {
        ...base,
        status: "succeeded",
        outputUrl: s.outputUrl,
        focalPoint: s.focalPoint ?? undefined,
        faceBox: s.faceBox ?? undefined,
      };
    }
    if (s?.error) {
      return {
        ...base,
        status: "failed",
        error: s.error.message,
        errorCode: s.error.code,
      };
    }
    return {
      ...base,
      streamPhaseId: s?.phaseId ?? null,
      streamAttributes: s?.attributes ?? null,
      presetMeta: presetMetaBySlug[slug] ?? primaryPreset,
    };
  });

  const allDone =
    liveResults.length > 0 &&
    liveResults.every((r) => r.status === "succeeded");

  // Single source of truth for the cinematic Develop step's progress,
  // timer and phase state — derived from the real streamed batch view,
  // never a separate fake countdown (VES-43/44 acceptance criterion).
  const studioProgress = deriveStudioProgress({
    medianPhaseId: view.medianPhaseId,
    slowestElapsedMs: view.slowestElapsedMs,
    allDone,
  });

  return (
    <>
      {studio ? (
        <StudioDevelopFrame
          results={liveResults}
          sourceUrl={studio.sourceUrl ?? userPhotoUrl}
          sourceName={studio.sourceName}
          sceneNames={studio.sceneNames}
          allDone={allDone}
          progress={studioProgress}
        />
      ) : (
        <DevelopGrid
          results={liveResults}
          variant={variant}
          sourceUrl={userPhotoUrl}
          onDownloadClick={onDownloadClick}
          onUnlockClick={onUnlockClick}
          editorial={editorial}
          freePreviewUnlocked={freePreviewUnlocked}
        />
      )}
      {stableSlugs.map((slug) => (
        <StreamTelemetry
          key={`tel-${slug}`}
          slug={slug}
          batchId={batchId}
          stream={view.streams[slug]}
        />
      ))}
    </>
  );
}

type Stream = ReturnType<typeof useProgressBatch>["streams"][string];

function StreamTelemetry({
  batchId,
  slug,
  stream,
}: {
  batchId: string;
  slug: string;
  stream: Stream | undefined;
}) {
  const startRef = useRef<number>(0);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!stream) return;
    if (stream.attributes !== null && !seenRef.current.has("__attrs")) {
      seenRef.current.add("__attrs");
      track("try_stream_attributes", { batchId, slug, hasAttributes: true });
    }
    if (stream.phaseId && !seenRef.current.has(`phase:${stream.phaseId}`)) {
      seenRef.current.add(`phase:${stream.phaseId}`);
      track("try_stream_phase", {
        batchId,
        slug,
        phaseId: stream.phaseId,
        elapsedMs: stream.elapsedMs,
      });
    }
    if (stream.status === "done" && !seenRef.current.has("__done")) {
      seenRef.current.add("__done");
      track("try_stream_completed", {
        batchId,
        slug,
        totalMs: Date.now() - startRef.current,
      });
    } else if (stream.status === "error" && stream.error && !seenRef.current.has("__error")) {
      seenRef.current.add("__error");
      track("try_stream_error", {
        batchId,
        slug,
        message: stream.error.message,
        retryable: stream.error.retryable,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, slug, stream?.status, stream?.phaseId, stream?.attributes, stream?.error?.message]);

  return null;
}
