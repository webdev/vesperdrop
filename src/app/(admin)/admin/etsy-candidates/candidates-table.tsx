"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mock, setMock] = useState(true);
  const [replaceAll, setReplaceAll] = useState(false);
  // Global busy: only for batch operations that affect every row
  // (Generate selected, Re-ingest, Upload). Regenerate uses regenSet
  // so other rows stay enabled.
  const [busy, setBusy] = useState(false);
  const [regenSet, setRegenSet] = useState<Set<string>>(new Set());
  const [slotMenuFor, setSlotMenuFor] = useState<string | null>(null);

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
        const res = await fetch(
          `/api/admin/etsy/status?pageId=${row.preview.id}`,
          { credentials: "same-origin" },
        );
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
      if (anyTerminal) router.refresh();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [rows, router]);

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
        credentials: "same-origin",
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
      await fetch("/api/admin/etsy/ingest", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ replaceAll }),
      });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  function selectPending() {
    setSelected(
      new Set(rows.filter((r) => r.status === "pending").map((r) => r.id)),
    );
  }

  function selectAll() {
    setSelected(new Set(rows.map((r) => r.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("replaceAll", String(replaceAll));
      const res = await fetch("/api/admin/etsy/upload", {
        method: "POST",
        credentials: "same-origin",
        body: fd,
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

  async function copyLink(row: CandidateRow) {
    if (!row.preview) return;
    const url = `${window.location.origin}/etsy-preview/${row.preview.token}`;
    await navigator.clipboard.writeText(url);
    track("etsy_admin_copy_preview_link", {
      page_id: row.preview.id,
      preview_token: row.preview.token,
    });
  }

  async function regenerate(
    row: CandidateRow,
    slots?: Array<"hero" | "lifestyle" | "detail">,
  ) {
    if (!row.preview) return;
    const pageId = row.preview.id;
    // Three modes:
    //   slots provided     → /regenerate with {slots}: rebuild only those
    //   no slots, partial  → /retry: rebuild only failed slots
    //   no slots, completed → /regenerate: rebuild everything fresh
    const useRegen = slots !== undefined || row.preview.status === "completed";
    const endpoint = useRegen
      ? "/api/admin/etsy/regenerate"
      : "/api/admin/etsy/retry";
    setRegenSet((prev) => {
      const next = new Set(prev);
      next.add(pageId);
      return next;
    });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          slots ? { pageId, mock, slots } : { pageId, mock },
        ),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body);
      }
      // Soft refresh — re-renders the server component without disturbing
      // scroll position, selection, or other rows. The polling effect
      // picks up the new pending state for this row only.
      router.refresh();
    } finally {
      setRegenSet((prev) => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
    }
  }

  return (
    <section className="rounded-2xl border border-line-soft bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : `${rows.length} candidates`}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
            <button
              type="button"
              onClick={selectAll}
              className="rounded px-1.5 py-0.5 hover:text-ink"
            >
              all
            </button>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={selectPending}
              className="rounded px-1.5 py-0.5 hover:text-ink"
            >
              pending
            </button>
            {selectedIds.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded px-1.5 py-0.5 hover:text-ink"
                >
                  clear
                </button>
              </>
            ) : null}
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
          <Link
            href="https://fal.ai/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4 hover:text-ink-2"
          >
            fal.ai ↗
          </Link>
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
                      <div className="relative inline-flex items-stretch overflow-hidden rounded-full border border-line bg-paper">
                        <button
                          type="button"
                          onClick={() => regenerate(row)}
                          disabled={
                            row.preview ? regenSet.has(row.preview.id) : true
                          }
                          title="Regenerate based on row status (failed slots, or all if completed)"
                          className="px-3 py-1 text-[11px] text-ink-2 hover:bg-surface disabled:opacity-50"
                        >
                          {row.preview && regenSet.has(row.preview.id)
                            ? "Regen…"
                            : "Regen"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSlotMenuFor(
                              row.preview && slotMenuFor === row.preview.id
                                ? null
                                : row.preview?.id ?? null,
                            )
                          }
                          disabled={
                            row.preview ? regenSet.has(row.preview.id) : true
                          }
                          aria-label="Regen specific slot"
                          className="border-l border-line px-2 py-1 text-[11px] text-ink-3 hover:bg-surface disabled:opacity-50"
                        >
                          ▾
                        </button>
                        {row.preview && slotMenuFor === row.preview.id ? (
                          <div className="absolute right-0 top-full z-20 mt-1 flex flex-col rounded-xl border border-line-soft bg-paper p-1 shadow-[0_18px_40px_-22px_rgba(40,30,20,0.35)]">
                            {(["hero", "lifestyle", "detail"] as const).map(
                              (slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => {
                                    setSlotMenuFor(null);
                                    void regenerate(row, [slot]);
                                  }}
                                  className="rounded-md px-3 py-1.5 text-left text-[11px] capitalize text-ink-2 hover:bg-surface"
                                >
                                  Regen {slot}
                                </button>
                              ),
                            )}
                          </div>
                        ) : null}
                      </div>
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
