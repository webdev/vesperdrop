"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_LENGTH = 80;

type Props = {
  runId: string;
  /** User-set name from DB. Null when the user hasn't named this batch. */
  customName: string | null;
  /** Auto-derived title shown when customName is null. */
  fallback: string;
  /** Tailwind classes for the heading text. */
  className?: string;
  /** Heading level (defaults to h2). */
  as?: "h1" | "h2" | "h3";
};

/**
 * Inline-editable batch title. Click the title (or the pencil icon) to edit.
 * Save on blur or Enter, cancel on Escape. Empty input clears the custom name
 * and reverts to the auto-derived fallback.
 */
export function EditableRunTitle({
  runId,
  customName,
  fallback,
  className,
  as = "h2",
}: Props) {
  const Heading = as;
  const router = useRouter();
  const [name, setName] = useState<string | null>(customName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function start() {
    setDraft(name ?? "");
    setEditing(true);
  }

  async function commit(next: string) {
    const trimmed = next.trim();
    const desired = trimmed.length === 0 ? null : trimmed;
    if (desired === name) {
      setEditing(false);
      return;
    }
    setPending(true);
    setName(desired); // optimistic
    setEditing(false);
    try {
      const res = await fetch(`/api/runs/${runId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: desired }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      console.error("rename failed", err);
      setName(customName); // revert
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        defaultValue={draft}
        maxLength={MAX_LENGTH}
        placeholder={fallback}
        aria-label="Batch name"
        className={`${className ?? ""} -mx-1 min-w-0 max-w-full rounded-sm border-b border-ink-4 bg-transparent px-1 outline-none focus:border-ink`}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(e.currentTarget.value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
      />
    );
  }

  const displayed = name ?? fallback;
  const isFallback = name == null;

  return (
    <Heading className={`group/title relative inline-flex items-center gap-2 ${className ?? ""}`}>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        title="Rename"
        aria-label={`Rename batch (current: ${displayed})`}
        className={`-mx-1 rounded-sm px-1 text-left transition-colors ${isFallback ? "text-ink-3" : "text-ink"} hover:bg-paper-2 focus:bg-paper-2 focus:outline-none`}
      >
        {displayed}
      </button>
      <span
        aria-hidden
        className="opacity-0 transition-opacity group-hover/title:opacity-60 group-focus-within/title:opacity-60"
      >
        <PencilIcon />
      </span>
    </Heading>
  );
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block align-baseline"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
