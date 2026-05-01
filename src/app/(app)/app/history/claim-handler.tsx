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

    let payload: PendingBatch | null = null;
    try {
      const raw = window.sessionStorage.getItem(PENDING_BATCH_KEY);
      if (!raw) return;
      payload = JSON.parse(raw) as PendingBatch;
    } catch {
      window.sessionStorage.removeItem(PENDING_BATCH_KEY);
      return;
    }
    if (!payload || payload.generations.length === 0) {
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
        window.sessionStorage.removeItem(PENDING_BATCH_KEY);
        if (data.runId) {
          router.replace(`/app/history?claim=${encodeURIComponent(data.runId)}`);
          router.refresh();
        } else {
          router.refresh();
        }
      } catch {}
    })();
  }, [router]);

  return null;
}
