"use client";

export type CandidateRow = {
  id: string;
  title: string;
  shopName: string | null;
  imageUrl: string | null;
  listingUrl: string;
  status:
    | "pending"
    | "generating"
    | "completed"
    | "partial"
    | "failed"
    | "skipped"
    | "to_review";
  updatedAt: string;
  preview: { id: string; token: string; status: string } | null;
};

export function CandidatesTable({ rows }: { rows: CandidateRow[] }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Candidates table — {rows.length} rows
      </p>
    </div>
  );
}
