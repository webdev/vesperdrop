"use client";

// CONTRACT: `sceneSlugs` MUST have stable length and order for the lifetime of
// this hook. We call useProgressStream() inside a .map() over the array; React's
// hook rules require that count and order never change between renders. The
// caller (<ProgressScreen />) mounts once per generation attempt, satisfying this.

import { useEffect, useMemo, useRef, useState } from "react";
import { useProgressStream, type StreamHandle } from "./use-progress-stream";
import { aggregateBatch, type StreamSnapshot } from "./batch-aggregate";
import { pickLine, type PresetMeta } from "./strings";

const ROTATION_MS = 2800;
const COUNTER_HOLD_MS = 3000;
const REANCHOR_AT_MS = 60_000;
const REANCHOR_LINE = "Almost there — the high-res pass takes a beat longer.";

export type BatchView = {
  streams: Record<string, StreamHandle>;
  primaryPreset: PresetMeta;
  primaryAttributes: StreamHandle["attributes"];
  currentLine: string;
  showCounter: boolean;
  doneCount: number;
  totalCount: number;
  allDone: boolean;
  allFailed: boolean;
  isHighlightingFilmstrip: boolean;
  filmstripIndex: number;
};

export function useProgressBatch(args: {
  file: File;
  sceneSlugs: string[];
  primaryPreset: PresetMeta;
}): BatchView {
  const { file, sceneSlugs, primaryPreset } = args;

  const handles = sceneSlugs.map((slug) => ({
    slug,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    handle: useProgressStream({ file, sceneSlug: slug }),
  }));
  const streams: Record<string, StreamHandle> = Object.fromEntries(
    handles.map(({ slug, handle }) => [slug, handle]),
  );

  const primary = handles[0]?.handle ?? null;

  const snapshots: StreamSnapshot[] = handles.map(({ handle }) => ({
    status: handle.status,
    phaseId: handle.phaseId,
    outputUrl: handle.outputUrl,
    error: handle.error,
    elapsedMs: handle.elapsedMs,
  }));

  const agg = aggregateBatch(snapshots);

  const [currentLine, setCurrentLine] = useState("");
  const [counterTick, setCounterTick] = useState(false);
  const [filmstripIndex, setFilmstripIndex] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const reanchorShownRef = useRef(false);
  const historyRef = useRef<string[]>([]);

  // Refs for values we read inside the rotation interval but do NOT want as
  // effect deps — including them would tear down and re-create the 2.8s
  // interval on every server tick / client smooth tick, so it never fires.
  const slowestElapsedRef = useRef(agg.slowestElapsedMs);
  const allDoneRef = useRef(agg.allDone);
  const attributesRef = useRef(primary?.attributes ?? null);
  const presetRef = useRef(primaryPreset);
  useEffect(() => {
    slowestElapsedRef.current = agg.slowestElapsedMs;
    allDoneRef.current = agg.allDone;
    attributesRef.current = primary?.attributes ?? null;
    presetRef.current = primaryPreset;
  });

  useEffect(() => {
    if (!agg.medianPhaseId) return;
    const phaseId = agg.medianPhaseId;

    const rotate = () => {
      if (
        !reanchorShownRef.current &&
        slowestElapsedRef.current > REANCHOR_AT_MS &&
        !allDoneRef.current
      ) {
        reanchorShownRef.current = true;
        setCurrentLine(REANCHOR_LINE);
        return;
      }
      const line = pickLine(
        phaseId,
        attributesRef.current,
        presetRef.current,
        historyRef.current,
      );
      historyRef.current = [...historyRef.current.slice(-2), line];
      setCurrentLine(line);
      setFilmstripIndex((i) => (i + 1) % 5);
      setHighlight(true);
      window.setTimeout(() => setHighlight(false), 1800);
    };
    rotate(); // fire first line immediately so the screen doesn't sit on "Getting things ready…"
    const interval = window.setInterval(rotate, ROTATION_MS);
    return () => window.clearInterval(interval);
  }, [agg.medianPhaseId]);

  useEffect(() => {
    if (!agg.showCounter) return;
    const t = window.setInterval(() => setCounterTick((b) => !b), COUNTER_HOLD_MS);
    return () => window.clearInterval(t);
  }, [agg.showCounter]);

  const displayLine = useMemo(() => {
    if (agg.showCounter && counterTick) {
      return `${agg.doneCount} of ${agg.totalCount} done`;
    }
    return currentLine;
  }, [agg.showCounter, agg.doneCount, agg.totalCount, counterTick, currentLine]);

  return {
    streams,
    primaryPreset,
    primaryAttributes: primary?.attributes ?? null,
    currentLine: displayLine,
    showCounter: agg.showCounter,
    doneCount: agg.doneCount,
    totalCount: agg.totalCount,
    allDone: agg.allDone,
    allFailed: agg.allFailed,
    isHighlightingFilmstrip: highlight,
    filmstripIndex,
  };
}
