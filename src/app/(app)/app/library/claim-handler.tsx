"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const PENDING_BATCH_KEY = "vd_pending_batch";

type PendingBatch = {
  source: { url: string; name: string };
  generations: Array<{
    sceneSlug: string;
    sceneName: string;
    outputUrl: string;
    rawUrl?: string;
  }>;
};

export function ClaimHandler() {
  const router = useRouter();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // Prefer localStorage — try-flow writes to both storages, but only
    // localStorage survives the user closing the tab to check their
    // email for the signup confirmation link. sessionStorage is a
    // belt-and-braces fallback for stale tabs.
    let payload: PendingBatch | null = null;
    let raw: string | null = null;
    try {
      raw =
        window.localStorage.getItem(PENDING_BATCH_KEY) ??
        window.sessionStorage.getItem(PENDING_BATCH_KEY);
      if (!raw) return;
      payload = JSON.parse(raw) as PendingBatch;
    } catch {
      window.localStorage.removeItem(PENDING_BATCH_KEY);
      window.sessionStorage.removeItem(PENDING_BATCH_KEY);
      return;
    }
    if (!payload || payload.generations.length === 0) {
      window.localStorage.removeItem(PENDING_BATCH_KEY);
      window.sessionStorage.removeItem(PENDING_BATCH_KEY);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/try/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { runId?: string };
        window.localStorage.removeItem(PENDING_BATCH_KEY);
        window.sessionStorage.removeItem(PENDING_BATCH_KEY);
        if (data.runId) {
          router.replace(`/app/library?claim=${encodeURIComponent(data.runId)}`);
          router.refresh();
        } else {
          router.refresh();
        }
      } catch {}
    })();
  }, [router]);

  return null;
}
