"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompleteLookButton } from "@/components/app/complete-look-button";
import type { Pack } from "@/app/(app)/app/runs/[id]/run-grid";

interface Props {
  runId: string;
  /** Generation ID to spin off — typically the hero (first succeeded) gen. */
  parentGenerationId: string;
  /** Pro paywall state — when locked, popover shows the upgrade card. */
  locked?: boolean;
  /** Disable when the parent gen has no Sceneify ID (can't be spun off). */
  disabled?: boolean;
}

/**
 * Library-card wrapper around CompleteLookButton. Reuses the same popover and
 * platform picker, but routes the user to the batch detail page after a pack
 * is created so they can watch progress in the existing PackGallery surface.
 *
 * We prefetch the run page on mount so the post-success navigation feels
 * instant — by the time the API call returns, the destination is already
 * warm in the router cache.
 */
export function LibraryCompleteLookButton({
  runId,
  parentGenerationId,
  locked,
  disabled,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(`/app/runs/${runId}`);
  }, [router, runId]);

  return (
    <CompleteLookButton
      runId={runId}
      parentGenerationId={parentGenerationId}
      disabled={disabled}
      locked={locked}
      onPackCreated={(pack: Pack) => {
        router.push(`/app/runs/${runId}#pack-${pack.id}`);
      }}
      triggerClassName="group/cta inline-flex items-center gap-2 rounded-full border border-line bg-cream px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink shadow-subtle transition-all duration-200 hover:border-terracotta/40 hover:bg-terracotta-wash hover:shadow-[0_4px_14px_rgba(194,96,76,0.15)]"
      triggerLabel={
        <>
          <SparkIcon />
          Complete the look
        </>
      }
    />
  );
}

function SparkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="text-terracotta transition-transform duration-200 group-hover/cta:scale-110"
    >
      <path d="M12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10z" />
    </svg>
  );
}
