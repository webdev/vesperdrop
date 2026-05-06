"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
    | "queued"
    | "generating"
    | "completed"
    | "partial"
    | "failed"
    | "skipped"
    | "to_review";
  updatedAt: string;
  preview: {
    id: string;
    token: string;
    status: string;
    slots: {
      hero: { url: string | null; status: string };
      lifestyle: { url: string | null; status: string };
      detail: { url: string | null; status: string };
    };
  } | null;
};

type SlotKey = "hero" | "lifestyle" | "detail";

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
  // Mock mode defaults OFF — operators reaching for Generate / Regen
  // expect real fal.ai output. Mock is opt-in for layout iteration.
  const [mock, setMock] = useState(false);
  const [replaceAll, setReplaceAll] = useState(false);
  // Global busy: only for batch operations that affect every row
  // (Generate selected, Re-ingest, Upload). Regenerate uses regenSet
  // so other rows stay enabled.
  const [busy, setBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [regenSet, setRegenSet] = useState<Set<string>>(new Set());
  const [slotMenuFor, setSlotMenuFor] = useState<string | null>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const [pickedSlots, setPickedSlots] = useState<Set<SlotKey>>(
    new Set(["hero", "lifestyle", "detail"]),
  );
  const [msgMenuFor, setMsgMenuFor] = useState<string | null>(null);
  const [msgMenuRect, setMsgMenuRect] = useState<DOMRect | null>(null);
  const [copiedTpl, setCopiedTpl] = useState<string | null>(null);

  function openSlotMenu(pageId: string, trigger: HTMLElement) {
    setPickedSlots(new Set(["hero", "lifestyle", "detail"]));
    setMenuRect(trigger.getBoundingClientRect());
    setSlotMenuFor(pageId);
  }

  function openMsgMenu(pageId: string, trigger: HTMLElement) {
    setMsgMenuRect(trigger.getBoundingClientRect());
    setMsgMenuFor(pageId);
  }

  type OutreachTemplate = {
    id: "compliment" | "direct" | "question";
    label: string;
    body: string;
  };

  function buildMessages(row: CandidateRow): OutreachTemplate[] {
    if (!row.preview) return [];
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/etsy-preview/${row.preview.token}`
        : `/etsy-preview/${row.preview.token}`;
    const shop = row.shopName ?? "there";
    const title = row.title;
    return [
      {
        id: "compliment",
        label: "Compliment",
        body: `Hi ${shop} — your ${title} caught my eye while I was browsing vintage shops. I built a tool that turns Etsy flat-lays into editorial campaign imagery, and I made you a free preview of what it could look like:\n\n${url}\n\nNo signup to view. If it's interesting, the same thing takes about 5 minutes for any listing. Would love to hear what you think.`,
      },
      {
        id: "direct",
        label: "Direct",
        body: `Hi ${shop} — I'm building a tool for independent Etsy sellers that creates lifestyle/on-model shots from existing flat-lay photos. I made you a private preview using your ${title} to show what it looks like:\n\n${url}\n\nNo account needed. If you have 20 seconds, take a look. Genuinely curious whether this would be useful or not.`,
      },
      {
        id: "question",
        label: "Question",
        body: `Hi ${shop} — quick question: have you ever wanted lifestyle/on-model imagery for your listings without doing a photoshoot? I built a tool that generates them from your existing photos and made you a private sample with your ${title}:\n\n${url}\n\nMind taking a look and telling me if it's something you'd actually use? I'd really appreciate the feedback either way.`,
      },
    ];
  }

  async function copyMessage(row: CandidateRow, template: OutreachTemplate) {
    if (!row.preview) return;
    await navigator.clipboard.writeText(template.body);
    setCopiedTpl(`${row.preview.id}:${template.id}`);
    window.setTimeout(() => {
      setCopiedTpl((cur) =>
        cur === `${row.preview!.id}:${template.id}` ? null : cur,
      );
    }, 1500);
  }

  // Close popovers on scroll/resize so their anchors don't drift away
  // from their trigger buttons (we use position:fixed coordinates).
  useEffect(() => {
    if (!slotMenuFor && !msgMenuFor) return;
    const close = () => {
      setSlotMenuFor(null);
      setMsgMenuFor(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [slotMenuFor, msgMenuFor]);

  function toggleSlot(slot: SlotKey) {
    setPickedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }

  // Close any open popover when clicking outside or pressing Escape.
  useEffect(() => {
    if (!slotMenuFor && !msgMenuFor) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest("[data-slot-menu]")) setSlotMenuFor(null);
      if (!t?.closest("[data-msg-menu]")) setMsgMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSlotMenuFor(null);
        setMsgMenuFor(null);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [slotMenuFor, msgMenuFor]);

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
    // Chunk client-side and feed the API sequentially. Each chunk
    // creates DB rows and starts workflows synchronously inside the
    // route handler, so a Vercel function instance can't be terminated
    // mid-batch. The runtime concurrency is still gated server-side
    // (FAL_GATE + chunkAndRun).
    const CHUNK = 25;
    const total = selectedIds.length;
    setBusy(true);
    setBatchProgress({ done: 0, total });
    try {
      track("etsy_admin_generation_submitted", { count: total, mock });
      for (let i = 0; i < total; i += CHUNK) {
        const ids = selectedIds.slice(i, i + CHUNK);
        const res = await fetch("/api/admin/etsy/generate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ candidateIds: ids, mock }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body);
        }
        setBatchProgress({ done: Math.min(i + CHUNK, total), total });
      }
      router.refresh();
    } finally {
      setBusy(false);
      setBatchProgress(null);
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
          <label
            className={
              mock
                ? "flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[12px] text-amber-800"
                : "flex items-center gap-2 text-[12px] text-ink-3"
            }
            title="When on, generation skips fal.ai and writes the source URL to each slot"
          >
            <input
              type="checkbox"
              checked={mock}
              onChange={(e) => setMock(e.target.checked)}
            />
            Mock mode{mock ? " · ON" : ""}
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
            {batchProgress
              ? `Enqueueing ${batchProgress.done} / ${batchProgress.total}…`
              : "Generate selected"}
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
                      <button
                        type="button"
                        data-slot-menu
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!row.preview) return;
                          if (slotMenuFor === row.preview.id) {
                            setSlotMenuFor(null);
                          } else {
                            openSlotMenu(row.preview.id, e.currentTarget);
                          }
                        }}
                        disabled={
                          row.preview ? regenSet.has(row.preview.id) : true
                        }
                        aria-expanded={
                          row.preview ? slotMenuFor === row.preview.id : false
                        }
                        title="Pick which images to regenerate"
                        className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2 hover:bg-surface disabled:opacity-50"
                      >
                        {row.preview && regenSet.has(row.preview.id)
                          ? "Regen…"
                          : "Regen ▾"}
                      </button>
                      <button
                        type="button"
                        data-msg-menu
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!row.preview) return;
                          if (msgMenuFor === row.preview.id) {
                            setMsgMenuFor(null);
                          } else {
                            openMsgMenu(row.preview.id, e.currentTarget);
                          }
                        }}
                        aria-expanded={
                          row.preview ? msgMenuFor === row.preview.id : false
                        }
                        title="Copy outreach message for this seller"
                        className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2 hover:bg-surface"
                      >
                        Msg ▾
                      </button>
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
      {slotMenuFor && menuRect
        ? (() => {
            const row = rows.find((r) => r.preview?.id === slotMenuFor);
            if (!row || !row.preview) return null;
            // Position above the trigger when there's room above; otherwise
            // below. Right-align with the trigger's right edge so the
            // popover stays inside the viewport on narrow screens.
            const POPOVER_W = 280;
            const POPOVER_H_EST = 280;
            const placeAbove = menuRect.top > POPOVER_H_EST + 16;
            const top = placeAbove
              ? Math.max(8, menuRect.top - POPOVER_H_EST - 8)
              : menuRect.bottom + 8;
            const left = Math.max(
              8,
              Math.min(
                window.innerWidth - POPOVER_W - 8,
                menuRect.right - POPOVER_W,
              ),
            );
            return createPortal(
              <div
                data-slot-menu
                style={{
                  position: "fixed",
                  top,
                  left,
                  width: POPOVER_W,
                  zIndex: 9999,
                }}
                className="rounded-xl border border-line-soft bg-paper p-2 shadow-[0_24px_60px_-20px_rgba(40,30,20,0.45)]"
              >
                <p className="mb-2 px-2 pt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-4">
                  Select to regenerate
                </p>
                <ul className="flex flex-col">
                  {(["hero", "lifestyle", "detail"] as const).map((slot) => {
                    const s = row.preview!.slots[slot];
                    const checked = pickedSlots.has(slot);
                    return (
                      <li key={slot}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-surface">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSlot(slot)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-line-soft bg-cream/50">
                            {s.url ? (
                              <Image
                                src={s.url}
                                alt=""
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : null}
                          </span>
                          <span className="flex flex-col">
                            <span className="text-[12px] capitalize text-ink">
                              {slot}
                            </span>
                            <span
                              className={
                                s.status === "succeeded"
                                  ? "font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-700"
                                  : s.status === "failed"
                                    ? "font-mono text-[9px] uppercase tracking-[0.14em] text-rose-700"
                                    : s.status === "running"
                                      ? "font-mono text-[9px] uppercase tracking-[0.14em] text-amber-700"
                                      : "font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4"
                              }
                            >
                              {s.status}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-line-soft/70 px-2 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPickedSlots(
                        pickedSlots.size === 3
                          ? new Set()
                          : new Set(["hero", "lifestyle", "detail"]),
                      )
                    }
                    className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-4 hover:text-ink-2"
                  >
                    {pickedSlots.size === 3 ? "none" : "all"}
                  </button>
                  <button
                    type="button"
                    disabled={pickedSlots.size === 0}
                    onClick={() => {
                      const slots = Array.from(pickedSlots);
                      setSlotMenuFor(null);
                      void regenerate(row, slots as SlotKey[]);
                    }}
                    className="rounded-full bg-ink px-3.5 py-1 text-[11px] font-medium text-cream hover:bg-ink-2 disabled:opacity-40"
                  >
                    Regenerate
                  </button>
                </div>
              </div>,
              document.body,
            );
          })()
        : null}
      {msgMenuFor && msgMenuRect
        ? (() => {
            const row = rows.find((r) => r.preview?.id === msgMenuFor);
            if (!row || !row.preview) return null;
            const messages = buildMessages(row);
            const POPOVER_W = 380;
            const POPOVER_H_EST = 360;
            const placeAbove = msgMenuRect.top > POPOVER_H_EST + 16;
            const top = placeAbove
              ? Math.max(8, msgMenuRect.top - POPOVER_H_EST - 8)
              : msgMenuRect.bottom + 8;
            const left = Math.max(
              8,
              Math.min(
                window.innerWidth - POPOVER_W - 8,
                msgMenuRect.right - POPOVER_W,
              ),
            );
            return createPortal(
              <div
                data-msg-menu
                style={{
                  position: "fixed",
                  top,
                  left,
                  width: POPOVER_W,
                  zIndex: 9999,
                }}
                className="rounded-xl border border-line-soft bg-paper p-3 shadow-[0_24px_60px_-20px_rgba(40,30,20,0.45)]"
              >
                <p className="mb-3 px-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-4">
                  Outreach message
                </p>
                <ul className="flex flex-col gap-1.5">
                  {messages.map((tpl) => {
                    const isCopied =
                      copiedTpl === `${row.preview!.id}:${tpl.id}`;
                    return (
                      <li
                        key={tpl.id}
                        className="rounded-lg border border-line-soft bg-cream/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
                            {tpl.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              void copyMessage(row, tpl);
                            }}
                            className={
                              isCopied
                                ? "rounded-full bg-emerald-700 px-3 py-0.5 text-[10px] font-medium text-cream"
                                : "rounded-full bg-ink px-3 py-0.5 text-[10px] font-medium text-cream hover:bg-ink-2"
                            }
                          >
                            {isCopied ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <p className="mt-2 line-clamp-3 whitespace-pre-line text-[11px] leading-[1.4] text-ink-3">
                          {tpl.body}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-4">
                  Tip · personalize before sending
                </p>
              </div>,
              document.body,
            );
          })()
        : null}
    </section>
  );
}
