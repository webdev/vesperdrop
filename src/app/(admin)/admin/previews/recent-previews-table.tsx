"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type PreviewOutputThumb = {
  url: string;
  presetTitle: string;
  sourceIndex: number;
  slotType?: "lifestyle_hero" | "storefront" | "detail";
};

const SLOT_CHIP: Record<
  NonNullable<PreviewOutputThumb["slotType"]>,
  string
> = {
  lifestyle_hero: "HERO",
  storefront: "STOREFRONT",
  detail: "DETAIL",
};

const SLOT_NEXT_LABEL: Record<
  NonNullable<PreviewOutputThumb["slotType"]>,
  string
> = {
  lifestyle_hero: "+ Add hero",
  storefront: "+ Add storefront",
  detail: "+ Add detail",
};
const SLOT_PRIORITY: Array<NonNullable<PreviewOutputThumb["slotType"]>> = [
  "lifestyle_hero",
  "storefront",
  "detail",
];

export type PreviewSourceThumb = { url: string; name: string };

export type PreviewRow = {
  id: string;
  slug: string;
  title: string;
  sourceCount: number;
  presetTitle: string;
  status: "pending" | "queued" | "generating" | "completed" | "partial" | "failed";
  createdAt: string;
  firstSourceUrl: string | null;
  sources: PreviewSourceThumb[];
  outputs: PreviewOutputThumb[];
  expectedOutputCount: number;
  viewCount: number;
  ctaClickCount: number;
  signupClickCount: number;
  signupCount: number;
};

function formatRelative(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const STATUS_STYLES: Record<PreviewRow["status"], string> = {
  pending: "bg-surface text-ink-3 border-line-soft",
  queued: "bg-sky-50 text-sky-800 border-sky-200",
  generating: "bg-amber-50 text-amber-800 border-amber-200",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-emerald-50 text-emerald-800 border-emerald-200",
  failed: "bg-rose-50 text-rose-800 border-rose-200",
};

const STATUS_LABEL: Record<PreviewRow["status"], string> = {
  pending: "Pending",
  queued: "Queued",
  generating: "Generating",
  completed: "Ready",
  partial: "Partial",
  failed: "Failed",
};

export function RecentPreviewsTable({ rows }: { rows: PreviewRow[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [regenRow, setRegenRow] = useState<PreviewRow | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const visibleRows = rows.filter((r) => !hidden.has(r.id));
  const hasInflight = visibleRows.some(
    (r) =>
      r.status === "pending" ||
      r.status === "queued" ||
      r.status === "generating",
  );

  useEffect(() => {
    if (!hasInflight) return;
    const id = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(id);
  }, [hasInflight, router]);

  async function retryPreview(id: string) {
    if (retryingId) return;
    setRetryingId(id);
    try {
      const res = await fetch(`/api/admin/previews/${id}/retry`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "retry failed");
      }
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRetryingId(null);
    }
  }

  async function deletePreview(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/previews/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "delete failed");
      }
      setHidden((prev) => new Set(prev).add(id));
      setConfirmingId(null);
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  async function copyLink(slug: string) {
    const url = `${window.location.origin}/p/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(slug);
    window.setTimeout(() => {
      setCopied((c) => (c === slug ? null : c));
    }, 1500);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line-soft bg-paper px-6 py-10 text-center text-[13px] text-ink-3">
        No previews yet. Generate one above.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line-soft bg-surface">
      <table className="w-full text-[13px]">
        <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
          <tr className="border-b border-line-soft">
            <th className="px-4 py-3 text-left">Preview</th>
            <th className="px-3 py-3 text-left">Images</th>
            <th className="px-3 py-3 text-left">Preset</th>
            <th className="px-3 py-3 text-left">Created</th>
            <th className="px-3 py-3 text-left">Status</th>
            <th className="px-3 py-3 text-left">Link</th>
            <th className="px-3 py-3 text-left">Visits</th>
            <th className="px-3 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => {
            const ready =
              row.status === "completed" || row.status === "partial";
            const isConfirming = confirmingId === row.id;
            const isDeleting = deletingId === row.id;
            return (
              <tr
                key={row.id}
                className="border-b border-line-soft last:border-0 hover:bg-paper/40"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {row.firstSourceUrl ? (
                      <Image
                        src={row.firstSourceUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-md object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md border border-line-soft bg-paper" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-ink">{row.title}</p>
                      <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
                        {row.slug.slice(0, 10)}…
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-ink-3">{row.sourceCount}</td>
                <td className="px-3 py-3 text-ink-3">{row.presetTitle}</td>
                <td className="px-3 py-3 text-ink-4" suppressHydrationWarning>
                  {formatRelative(row.createdAt)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                      STATUS_STYLES[row.status],
                    )}
                  >
                    {(row.status === "generating" ||
                      row.status === "queued" ||
                      row.status === "pending") && (
                      <span className="relative flex h-1.5 w-1.5" aria-hidden>
                        <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
                      </span>
                    )}
                    {STATUS_LABEL[row.status]}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {ready ? (
                    <button
                      type="button"
                      onClick={() => copyLink(row.slug)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px]",
                        copied === row.slug
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-line bg-paper text-ink-2 hover:bg-surface",
                      )}
                    >
                      {copied === row.slug ? "Copied" : "Copy link"}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] text-ink-4">
                      <LockIcon /> —
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {ready ? (
                    row.viewCount > 0 ? (
                      <span className="inline-flex items-baseline gap-1.5 text-[12px] text-ink">
                        <span className="font-medium text-ink">
                          {row.viewCount}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
                          {row.viewCount === 1 ? "visit" : "visits"}
                        </span>
                        {row.ctaClickCount > 0 ? (
                          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4">
                            · {row.ctaClickCount} click
                            {row.ctaClickCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
                        No visits
                      </span>
                    )
                  ) : (
                    <span className="text-ink-4">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/p/${row.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open preview"
                      className="grid h-7 w-7 place-items-center rounded-full border border-line bg-paper text-ink-2 hover:bg-surface"
                    >
                      <EyeIcon />
                    </a>
                    {row.outputs.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => retryPreview(row.id)}
                        disabled={
                          retryingId === row.id || row.status === "completed"
                        }
                        className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2 hover:bg-surface disabled:opacity-40"
                      >
                        {retryingId === row.id ? "Retrying…" : "Retry"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRegenRow(row)}
                        className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2 hover:bg-surface"
                      >
                        Regen
                      </button>
                    )}
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => deletePreview(row.id)}
                          disabled={isDeleting}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                        >
                          {isDeleting ? "Deleting…" : "Confirm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          disabled={isDeleting}
                          className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2 hover:bg-surface"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        aria-label="Delete preview"
                        onClick={() => setConfirmingId(row.id)}
                        className="grid h-7 w-7 place-items-center rounded-full border border-line bg-paper text-ink-3 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {regenRow && (
        <RegenerateDialog
          row={regenRow}
          onClose={() => setRegenRow(null)}
          onComplete={() => {
            setRegenRow(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RegenerateDialog({
  row,
  onClose,
  onComplete,
}: {
  row: PreviewRow;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0 || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/previews/${row.id}/regenerate`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ indexes: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "regenerate failed");
      }
      onComplete();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function addOneForSource(sourceIndex: number) {
    if (adding !== null) return;
    setError(null);
    setAdding(sourceIndex);
    try {
      const res = await fetch(`/api/admin/previews/${row.id}/add-source`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceIndex, count: 1 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "add failed");
      }
      onComplete();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-2xl border border-line-soft bg-paper p-5 shadow-[0_24px_60px_-24px_rgba(40,30,20,0.4)] md:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              Manage outputs
            </p>
            <h3 className="mt-1 font-serif text-[20px] leading-snug tracking-[-0.01em] text-ink">
              Per-reference generation
            </h3>
            <p className="mt-1 text-[12.5px] text-ink-3">
              Replace existing images by selecting them, or add new ones for a
              specific reference.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full border border-line bg-paper text-ink-3 hover:bg-surface"
          >
            ×
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          {row.sources.map((src, sIdx) => {
            const outputsForSource = row.outputs
              .map((o, idx) => ({ o, idx }))
              .filter((x) => x.o.sourceIndex === sIdx);
            const presentSlots = new Set(
              outputsForSource
                .map((x) => x.o.slotType)
                .filter(
                  (s): s is NonNullable<PreviewOutputThumb["slotType"]> =>
                    Boolean(s),
                ),
            );
            const nextMissing = SLOT_PRIORITY.find(
              (s) => !presentSlots.has(s),
            );
            const atMax = outputsForSource.length >= 3 || !nextMissing;
            const addLabel = nextMissing
              ? SLOT_NEXT_LABEL[nextMissing]
              : "+ Generate one more";
            return (
              <section
                key={sIdx}
                className="rounded-xl border border-line-soft bg-cream/40 p-3 md:p-4"
              >
                <header className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Image
                      src={src.url}
                      alt={src.name}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-md border border-line-soft object-cover"
                      unoptimized
                    />
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
                        Reference {String(sIdx + 1).padStart(2, "0")}
                      </p>
                      <p className="text-[11.5px] text-ink-4">
                        {outputsForSource.length} generated
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addOneForSource(sIdx)}
                    disabled={adding !== null || submitting || atMax}
                    className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2 hover:bg-surface disabled:opacity-50"
                  >
                    {adding === sIdx ? "Adding…" : atMax ? "Max 3" : addLabel}
                  </button>
                </header>
                {outputsForSource.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {outputsForSource.map(({ o, idx }) => {
                      const isSelected = selected.has(idx);
                      return (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={() => toggle(idx)}
                            className={cn(
                              "group relative block w-full overflow-hidden rounded-lg border bg-paper transition-all",
                              isSelected
                                ? "border-ink ring-2 ring-ink/30"
                                : "border-line-soft hover:border-ink-4",
                            )}
                          >
                            <Image
                              src={o.url}
                              alt={`Output ${idx + 1}`}
                              width={200}
                              height={200}
                              className="aspect-square w-full object-cover"
                              unoptimized
                            />
                            {o.slotType && (
                              <span className="absolute left-1.5 top-1.5 rounded-full border border-paper bg-ink/85 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-cream">
                                {SLOT_CHIP[o.slotType]}
                              </span>
                            )}
                            <span
                              className={cn(
                                "absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border-2 text-[10px] font-bold",
                                isSelected
                                  ? "border-paper bg-ink text-cream"
                                  : "border-paper bg-paper/70 text-transparent",
                              )}
                            >
                              ✓
                            </span>
                            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-ink/80 to-transparent px-1.5 pb-1 pt-3 text-left font-mono text-[8.5px] uppercase tracking-[0.14em] text-cream">
                              {o.presetTitle}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-dashed border-line-soft px-3 py-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
                    No outputs yet for this reference
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {selected.size === 0
              ? "Select images to replace, or add new ones above"
              : `${selected.size} selected to replace`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || adding !== null}
              className="rounded-full border border-line bg-paper px-4 py-2 text-[12px] text-ink-2 hover:bg-surface disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={
                selected.size === 0 || submitting || adding !== null
              }
              className="rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-cream hover:bg-ink-2 disabled:opacity-40"
            >
              {submitting ? "Regenerating…" : "Regenerate selected"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-rose-700">{error}</p>
        )}
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
      <rect
        x="5"
        y="11"
        width="14"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 11V8a4 4 0 1 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
      <path
        d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m1 0v12a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V7m4 4v6m4-6v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
