import { cn } from "@/lib/utils";
import type { EtsyCandidate } from "@/lib/db/schema";

const STYLES: Record<EtsyCandidate["status"], string> = {
  pending: "bg-surface text-ink-3 border-line-soft",
  generating: "bg-amber-50 text-amber-800 border-amber-200",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-emerald-50 text-emerald-800 border-emerald-200",
  failed: "bg-rose-50 text-rose-800 border-rose-200",
  skipped: "bg-surface text-ink-4 border-line-soft",
  to_review: "bg-cream text-ink-2 border-line-soft",
};

const LABELS: Record<EtsyCandidate["status"], string> = {
  pending: "Pending",
  generating: "Generating",
  completed: "Completed",
  partial: "Partial",
  failed: "Failed",
  skipped: "Skipped",
  to_review: "To review",
};

export function StatusPill({ status }: { status: EtsyCandidate["status"] }) {
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
