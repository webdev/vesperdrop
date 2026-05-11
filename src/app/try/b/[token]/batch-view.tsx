"use client";

import { useCallback, useState } from "react";
import { track } from "@/lib/analytics";
import { DevelopGrid, type TileResult } from "../../develop-grid";
import { EditorialClaimRail, TrustRow } from "../../editorial-rail";
import type { UnlockBatchGeneration } from "@/lib/db/schema";

export function BatchView({
  token,
  generations,
  initialClaimed,
}: {
  token: string;
  generations: UnlockBatchGeneration[];
  initialClaimed: boolean;
}) {
  const [claimed, setClaimed] = useState(initialClaimed);
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);

  // Convert persisted batch entries into the TileResult shape that
  // DevelopGrid expects. All tiles are "succeeded" — there's no
  // streaming on this page. Soft-locked is mirrored from the funnel
  // contract: index 0 is the free hero, indexes 1..N are paywalled.
  const tileResults: TileResult[] = generations.map((g) => ({
    sceneSlug: g.sceneSlug,
    sceneName: g.sceneName,
    status: "succeeded",
    outputUrl: g.outputUrl,
    rawUrl: g.rawUrl ?? undefined,
    isFreePreview: g.isFreePreview,
    softLocked: !g.isFreePreview,
    focalPoint: g.focalPoint ?? null,
    faceBox: g.faceBox ?? null,
  }));

  const triggerDownload = useCallback((url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const handleDownload = useCallback(
    (slug: string) => {
      track("try_tile_download_clicked", { slug });
      const gen = generations.find((g) => g.sceneSlug === slug);
      if (!gen) return;
      if (claimed && gen.isFreePreview) {
        // Hero post-claim: HD raw. Falls back to the watermarked
        // outputUrl if rawUrl wasn't captured (older batches).
        triggerDownload(
          gen.rawUrl ?? gen.outputUrl,
          `${gen.sceneName.toLowerCase().replace(/\s+/g, "-")}.png`,
        );
        return;
      }
      // Pre-claim hero, or any soft-locked tile: scroll the claim
      // form into view so the user knows what to do next.
      const el = document.querySelector(
        '[data-testid="otp-email-input"]',
      ) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus();
    },
    [claimed, generations, triggerDownload],
  );

  const handleUnlock = useCallback(() => {
    track("try_unlock_clicked");
    if (unlockSubmitting) return;
    setUnlockSubmitting(true);
    window.location.href = `/api/stripe/unlock-checkout?batchToken=${token}`;
  }, [unlockSubmitting, token]);

  const handleClaimSuccess = useCallback(async () => {
    track("try_studio_claimed");
    try {
      await fetch("/api/try/attach-batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch {}
    setClaimed(true);
  }, [token]);

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Your studio · Saved
          </p>
          <h1 className="mt-4 font-serif text-[clamp(2.5rem,5.5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-ink">
            In the{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              studio
            </em>
            .
          </h1>
        </div>
      </div>

      {/* Same full-bleed editorial stage as /try post-success. */}
      <div className="relative -mx-[calc(50vw-50%)] w-screen">
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_2fr_1fr] sm:gap-3">
          <DevelopGrid
            results={tileResults}
            variant="darkroom"
            editorial
            freePreviewUnlocked={claimed}
            onDownloadClick={handleDownload}
            onUnlockClick={handleUnlock}
          />
        </div>
      </div>

      <EditorialClaimRail
        generations={tileResults}
        claimed={claimed}
        onClaimSuccess={handleClaimSuccess}
        onUnlock={handleUnlock}
        unlockSubmitting={unlockSubmitting}
      />
      <TrustRow />
    </>
  );
}
