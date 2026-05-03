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
      triggerClassName="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink-4 hover:bg-paper-2"
      triggerLabel={
        <>
          Complete the look <PlusIcon />
        </>
      }
    />
  );
}

function PlusIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden
    >
      <path d="M4.4 0h1.2v4.4H10v1.2H5.6V10H4.4V5.6H0V4.4h4.4z" />
    </svg>
  );
}
