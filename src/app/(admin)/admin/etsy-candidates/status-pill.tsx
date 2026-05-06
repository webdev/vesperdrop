import { cn } from "@/lib/utils";
import type { EtsyCandidate } from "@/lib/db/schema";

// Display status is the candidate status union plus 'queued', which
// only lives on etsy_preview_pages but we surface it here so the pill
// can distinguish 'enqueued in WDK' from 'actively running.'
export type DisplayStatus = EtsyCandidate["status"] | "queued";

const STYLES: Record<DisplayStatus, string> = {
  pending: "bg-surface text-ink-3 border-line-soft",
  queued: "bg-sky-50 text-sky-800 border-sky-200",
  generating: "bg-amber-50 text-amber-800 border-amber-200",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-emerald-50 text-emerald-800 border-emerald-200",
  failed: "bg-rose-50 text-rose-800 border-rose-200",
  skipped: "bg-surface text-ink-4 border-line-soft",
  to_review: "bg-cream text-ink-2 border-line-soft",
};

const LABELS: Record<DisplayStatus, string> = {
  pending: "Pending",
  queued: "Queued",
  generating: "Generating",
  completed: "Completed",
  partial: "Partial",
  failed: "Failed",
  skipped: "Skipped",
  to_review: "To review",
};

export function StatusPill({ status }: { status: DisplayStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        STYLES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
