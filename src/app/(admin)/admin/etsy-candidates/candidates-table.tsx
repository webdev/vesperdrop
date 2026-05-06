"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { StatusPill } from "./status-pill";

export type CandidateRow = {
  id: string;
  title: string;
  shopName: string | null;
  shopUrl: string | null;
  imageUrl: string | null;
  listingUrl: string;
  location: string | null;
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

function formatRelative(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function CandidatesTable({ rows }: { rows: CandidateRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mock, setMock] = useState(true);
  const [replaceAll, setReplaceAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const fired = useRef<Set<string>>(new Set());
  useEffect(() => {
    const inflight = rows.filter(
      (r) =>
        r.preview &&
        r.preview.status !== "completed" &&
        r.preview.status !== "partial" &&
        r.preview.status !== "failed",
    );
    if (inflight.length === 0) return;
    const interval = window.setInterval(async () => {
      let anyTerminal = false;
      for (const row of inflight) {
        if (!row.preview || fired.current.has(row.preview.id)) continue;
        const res = await fetch(`/api/admin/etsy/status?pageId=${row.preview.id}`);
        if (!res.ok) continue;
        const data = (await res.json()) as { status: string };
        if (
          data.status === "completed" ||
          data.status === "partial" ||
          data.status === "failed"
        ) {
          track("etsy_admin_generation_completed", {
            page_id: row.preview.id,
            status: data.status as "completed" | "partial" | "failed",
          });
          fired.current.add(row.preview.id);
          anyTerminal = true;
        }
      }
      if (anyTerminal) window.location.reload();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [rows]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function generate() {
    if (selectedIds.length === 0) return;
    setBusy(true);
    try {
      track("etsy_admin_generation_submitted", { count: selectedIds.length, mock });
      const res = await fetch("/api/admin/etsy/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateIds: selectedIds, mock }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body);
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function ingest() {
    setBusy(true);
    try {
      await fetch("/api/admin/etsy/ingest", { method: "POST" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("replaceAll", String(replaceAll));
      const res = await fetch("/api/admin/etsy/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body);
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(row: CandidateRow) {
    if (!row.preview) return;
    const url = `${window.location.origin}/etsy-preview/${row.preview.token}`;
    await navigator.clipboard.writeText(url);
    track("etsy_admin_copy_preview_link", {
      page_id: row.preview.id,
      preview_token: row.preview.token,
    });
  }

  return (
    <section className="rounded-2xl border border-line-soft bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : `${rows.length} candidates`}
          </span>
          <label className="flex items-center gap-2 text-[12px] text-ink-3">
            <input
              type="checkbox"
              checked={mock}
              onChange={(e) => setMock(e.target.checked)}
            />
            Mock mode
          </label>
          <label className="flex items-center gap-2 text-[12px] text-ink-3">
            <input
              type="checkbox"
              checked={replaceAll}
              onChange={(e) => setReplaceAll(e.target.checked)}
            />
            Replace all
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={ingest}
            disabled={busy}
            className="rounded-full border border-line bg-paper px-4 py-2 text-[13px] text-ink-2 hover:bg-surface disabled:opacity-50"
          >
            Re-ingest MD
          </button>
          <label className="cursor-pointer rounded-full border border-line bg-paper px-4 py-2 text-[13px] text-ink-2 hover:bg-surface">
            Upload MD
            <input
              type="file"
              accept=".md,text/markdown,text/plain"
              className="hidden"
              onChange={onUpload}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={busy || selectedIds.length === 0}
            className="rounded-full bg-ink px-5 py-2 text-[13px] font-medium text-cream hover:bg-ink-2 disabled:opacity-40"
          >
            Generate selected
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            <tr className="border-b border-line-soft">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-2 py-3 text-left">Image</th>
              <th className="px-3 py-3 text-left">Title</th>
              <th className="px-3 py-3 text-left">Shop</th>
              <th className="px-3 py-3 text-left">Location</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Preview</th>
              <th className="px-3 py-3 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line-soft last:border-0 hover:bg-paper/40"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${row.title}`}
                  />
                </td>
                <td className="px-2 py-3">
                  {row.imageUrl ? (
                    <Image
                      src={row.imageUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-md object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-md border border-line-soft bg-paper" />
                  )}
                </td>
                <td className="max-w-[28ch] truncate px-3 py-3 text-ink">
                  <Link
                    href={row.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {row.title}
                  </Link>
                </td>
                <td className="px-3 py-3 text-ink-3">
                  {row.shopName ? (
                    row.shopUrl ? (
                      <Link
                        href={row.shopUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-ink hover:underline"
                      >
                        {row.shopName}
                      </Link>
                    ) : (
                      row.shopName
                    )
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-[18ch] truncate px-3 py-3 text-ink-4">
                  {row.location ?? "—"}
                </td>
                <td className="px-3 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-3 py-3">
                  {row.preview ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyLink(row)}
                        className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2 hover:bg-surface"
                      >
                        Copy
                      </button>
                      <Link
                        href={`/etsy-preview/${row.preview.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-ink px-3 py-1 text-[11px] text-cream hover:bg-ink-2"
                      >
                        Open
                      </Link>
                    </div>
                  ) : (
                    <span className="text-ink-4">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-4" suppressHydrationWarning>
                  {formatRelative(row.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
