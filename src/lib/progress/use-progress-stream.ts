"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSseParser } from "./sse-parser";
import type { ExtractedAttributes } from "@/lib/ai/extract-attributes";
import type { PhaseId, PresetMeta } from "./strings";
import type { FocalPoint, FaceBox } from "@/lib/ai/sceneify";

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
  focalPoint: FocalPoint | null;
  faceBox: FaceBox | null;
  // `code` lets callers distinguish business outcomes (e.g.
  // "credit_limit_reached" → render a sign-up prompt) from generic
  // failures. Server SSE may emit it on the "error" event; HTTP errors
  // surface it from the JSON body when the response wasn't a stream.
  error: { message: string; retryable: boolean; code?: string } | null;
};

export type StreamHandle = StreamState & {
  retry: () => void;
};

type Args = {
  file: File;
  sceneSlug: string;
  enabled?: boolean;
  /** Casting race forwarded as the `castingRace` FormData field on the
   *  /api/try/generate POST. The parent (`useProgressBatch`) picks ONE
   *  value per batch and passes the same string to every stream so all
   *  tiles in a batch render with the same model identity. Sceneify
   *  filters its reference pool by this token; unknown / empty values
   *  fall through to the default sampler. */
  castingRace?: string;
  /** Server-side persistence metadata (VES-53). When `token` + `batchSize`
   *  are supplied, /api/try/generate persists this tile to the batch as it
   *  completes and flushes any mid-generation email when the last tile
   *  settles — so a closed tab still delivers. Omitting them keeps the
   *  legacy stream-only behavior. */
  persist?: {
    token: string;
    batchSize: number;
    sceneName: string;
    isFreePreview: boolean;
  };
};

// Auto-retry policy for retryable errors. Generation failures bubble
// up as "RESHOOT NEEDED" tiles that are dead-ends — the user has no
// way to recover without restarting the whole batch. Server marks
// retryable=true for 5xx + transport errors and retryable=false for
// user-actionable codes (credit_limit_reached, quota_exhausted), so
// we only auto-fire on the former. Cap at 2 attempts to bound model
// cost; backoff with jitter to avoid thundering-herd against the
// upstream provider.
const MAX_AUTO_RETRIES = 2;
const RETRY_BACKOFF_MS = [1500, 4000];

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
  focalPoint: null,
  faceBox: null,
  error: null,
};

export function useProgressStream({
  file,
  sceneSlug,
  enabled = true,
  castingRace,
  persist,
}: Args): StreamHandle {
  const [state, setState] = useState<StreamState>(initial);
  // Destructure persist to stable primitives so the `open` callback (which
  // depends on these) isn't torn down every render by a fresh object ref.
  const persistToken = persist?.token;
  const persistBatchSize = persist?.batchSize;
  const persistSceneName = persist?.sceneName;
  const persistIsFreePreview = persist?.isFreePreview;
  const abortRef = useRef<AbortController | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const autoRetryRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  const open = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
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
    if (castingRace) form.append("castingRace", castingRace);
    // Server-side persistence metadata (VES-53). Sent on every (re)open so
    // an auto-retry re-persists under the same batch token.
    if (persistToken && persistBatchSize) {
      form.append("token", persistToken);
      form.append("batchSize", String(persistBatchSize));
      if (persistSceneName) form.append("sceneName", persistSceneName);
      form.append("isFreePreview", persistIsFreePreview ? "1" : "0");
    }

    (async () => {
      try {
        const res = await fetch("/api/try/generate", {
          method: "POST",
          body: form,
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          let message = `request failed: ${res.status}`;
          let code: string | undefined;
          try {
            const body = (await res.clone().json()) as {
              error?: string;
              code?: string;
            };
            if (body.error) message = body.error;
            if (body.code) code = body.code;
          } catch {
            /* response wasn't JSON; keep the generic message */
          }
          if (myRunId === runIdRef.current) {
            setState((s) => ({
              ...s,
              status: "error",
              error: { message, retryable: res.status >= 500, code },
            }));
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
            const d = data as {
              outputUrl: string;
              rawUrl?: string;
              focalPoint?: FocalPoint | null;
              faceBox?: FaceBox | null;
            };
            setState((s) => ({
              ...s,
              status: "done",
              outputUrl: d.outputUrl,
              rawUrl: d.rawUrl ?? null,
              focalPoint: d.focalPoint ?? null,
              faceBox: d.faceBox ?? null,
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
  }, [
    file,
    sceneSlug,
    castingRace,
    persistToken,
    persistBatchSize,
    persistSceneName,
    persistIsFreePreview,
  ]);

  useEffect(() => {
    if (!enabled) return;
    autoRetryRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    open();
    return () => {
      abortRef.current?.abort();
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [enabled, open]);

  // Auto-retry retryable errors. Tile UX previously dead-ended on
  // "RESHOOT NEEDED" with no recovery — now we silently reissue the
  // request up to MAX_AUTO_RETRIES times with backoff before
  // surfacing the failure to the user.
  useEffect(() => {
    if (state.status !== "error") return;
    if (!state.error?.retryable) return;
    if (autoRetryRef.current >= MAX_AUTO_RETRIES) return;
    const attempt = autoRetryRef.current;
    autoRetryRef.current += 1;
    const delay = RETRY_BACKOFF_MS[attempt] ?? 4000;
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      open();
    }, delay);
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [state.status, state.error?.retryable, open]);

  const retry = useCallback(() => {
    autoRetryRef.current = 0;
    open();
  }, [open]);

  return { ...state, retry };
}
