"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSseParser } from "./sse-parser";
import type { ExtractedAttributes } from "@/lib/ai/extract-attributes";
import type { PhaseId, PresetMeta } from "./strings";

export type StreamStatus = "idle" | "connecting" | "streaming" | "done" | "error";

export type StreamState = {
  status: StreamStatus;
  startedAt: number | null;
  preset: PresetMeta | null;
  attributes: ExtractedAttributes | null;
  phaseId: PhaseId | null;
  elapsedMs: number;
  outputUrl: string | null;
  rawUrl: string | null;
  sourceUrl: string | null;
  error: { message: string; retryable: boolean } | null;
};

export type StreamHandle = StreamState & {
  retry: () => void;
};

type Args = {
  file: File;
  sceneSlug: string;
  enabled?: boolean;
};

const initial: StreamState = {
  status: "idle",
  startedAt: null,
  preset: null,
  attributes: null,
  phaseId: null,
  elapsedMs: 0,
  outputUrl: null,
  rawUrl: null,
  sourceUrl: null,
  error: null,
};

export function useProgressStream({ file, sceneSlug, enabled = true }: Args): StreamHandle {
  const [state, setState] = useState<StreamState>(initial);
  const abortRef = useRef<AbortController | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const runIdRef = useRef(0);

  const open = useCallback(() => {
    runIdRef.current += 1;
    const myRunId = runIdRef.current;
    abortRef.current?.abort();
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setState({ ...initial, status: "connecting" });
    startedAtRef.current = null;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("sceneSlug", sceneSlug);

    (async () => {
      try {
        const res = await fetch("/api/try/generate", {
          method: "POST",
          body: form,
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          const message = `request failed: ${res.status}`;
          if (myRunId === runIdRef.current) {
            setState((s) => ({ ...s, status: "error", error: { message, retryable: res.status >= 500 } }));
          }
          return;
        }

        const parser = createSseParser((event, data) => {
          if (myRunId !== runIdRef.current) return;
          if (event === "ready") {
            const d = data as { startedAt: number };
            startedAtRef.current = d.startedAt;
            setState((s) => ({
              ...s,
              status: "streaming",
              startedAt: d.startedAt,
            }));
            if (tickRef.current === null) {
              tickRef.current = window.setInterval(() => {
                if (startedAtRef.current === null) return;
                setState((s) => ({ ...s, elapsedMs: Date.now() - startedAtRef.current! }));
              }, 250);
            }
          } else if (event === "source") {
            const d = data as { url: string } | null;
            if (d?.url) setState((s) => ({ ...s, sourceUrl: d.url }));
          } else if (event === "attributes") {
            setState((s) => ({ ...s, attributes: data as ExtractedAttributes | null }));
          } else if (event === "phase") {
            const d = data as { id: PhaseId; elapsedMs: number };
            setState((s) => ({ ...s, phaseId: d.id, elapsedMs: d.elapsedMs }));
          } else if (event === "tick") {
            setState((s) => ({ ...s, elapsedMs: (data as { elapsedMs: number }).elapsedMs }));
          } else if (event === "done") {
            const d = data as { outputUrl: string; rawUrl?: string };
            setState((s) => ({
              ...s,
              status: "done",
              outputUrl: d.outputUrl,
              rawUrl: d.rawUrl ?? null,
            }));
          } else if (event === "error") {
            const d = data as { message: string; retryable: boolean };
            setState((s) => ({ ...s, status: "error", error: d }));
          }
        });

        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) parser.feed(value);
        }
      } catch (e) {
        if (myRunId !== runIdRef.current) return;
        if ((e as { name?: string }).name === "AbortError") return;
        const message = e instanceof Error ? e.message : "connection lost";
        setState((s) => ({ ...s, status: "error", error: { message, retryable: true } }));
      } finally {
        if (myRunId === runIdRef.current && tickRef.current !== null) {
          window.clearInterval(tickRef.current);
          tickRef.current = null;
        }
      }
    })();
  }, [file, sceneSlug]);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    open();
    return () => {
      abortRef.current?.abort();
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [enabled, open]);

  return { ...state, retry: open };
}
