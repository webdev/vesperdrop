"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProgressBatch } from "@/lib/progress/use-progress-batch";
import { track } from "@/lib/analytics";
import type { PresetMeta } from "@/lib/progress/strings";
import { DevelopGrid, type DevelopGridVariant, type TileResult } from "./develop-grid";

type Props = {
  file: File;
  sceneSlugs: string[];
  userPhotoUrl: string;
  primaryPreset: PresetMeta;
  presetMetaBySlug: Record<string, PresetMeta>;
  variant: DevelopGridVariant;
  initialResults: TileResult[];
  onSettled: (
    results: Array<{ slug: string; outputUrl?: string; error?: string }>,
  ) => void;
};

export function ProgressScreen({
  file,
  sceneSlugs,
  userPhotoUrl,
  primaryPreset,
  presetMetaBySlug,
  variant,
  initialResults,
  onSettled,
}: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableSlugs = useMemo(() => sceneSlugs, []); // contract: stable for lifetime
  const view = useProgressBatch({ file, sceneSlugs: stableSlugs, primaryPreset });

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
      if (s?.outputUrl) return { slug, outputUrl: s.outputUrl };
      return { slug, error: s?.error?.message ?? "generation failed" };
    });
    onSettled(out);
  }, [view.streams, stableSlugs, onSettled, batchId]);

  // Augment the results with live-stream context so each tile renders the
  // rotating, slot-filled caption from streaming events.
  const liveResults: TileResult[] = stableSlugs.map((slug) => {
    const base = initialResults.find((r) => r.sceneSlug === slug) ?? {
      sceneSlug: slug,
      sceneName: presetMetaBySlug[slug]?.name ?? slug,
      status: "pending" as const,
    };
    const s = view.streams[slug];
    if (s?.outputUrl) {
      return { ...base, status: "succeeded", outputUrl: s.outputUrl };
    }
    if (s?.error) {
      return { ...base, status: "failed", error: s.error.message };
    }
    return {
      ...base,
      streamPhaseId: s?.phaseId ?? null,
      streamAttributes: s?.attributes ?? null,
      presetMeta: presetMetaBySlug[slug] ?? primaryPreset,
    };
  });

  return (
    <>
      <DevelopGrid results={liveResults} variant={variant} sourceUrl={userPhotoUrl} />
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
