"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type PreviewRow = {
  id: string;
  slug: string;
  title: string;
  sourceCount: number;
  presetTitle: string;
  status: "pending" | "queued" | "generating" | "completed" | "partial" | "failed";
  createdAt: string;
  firstSourceUrl: string | null;
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
  const [copied, setCopied] = useState<string | null>(null);

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
            <th className="px-3 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ready =
              row.status === "completed" || row.status === "partial";
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
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                      STATUS_STYLES[row.status],
                    )}
                  >
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
                    <button
                      type="button"
                      aria-label="More actions"
                      className="grid h-7 w-7 place-items-center rounded-full border border-line bg-paper text-ink-2 hover:bg-surface"
                    >
                      <DotsIcon />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </svg>
  );
}
