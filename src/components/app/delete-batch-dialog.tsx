"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  runId: string;
  /** Display name in the prompt — falls back to "this batch" when empty. */
  label?: string | null;
  /** Where to navigate after a successful delete. Default: stay (router.refresh). */
  redirectTo?: string;
  /**
   * A single element that opens the dialog. base-ui merges Trigger props
   * (onClick, ARIA, etc.) onto it via the `render` prop, so this must be
   * a real DOM-bearing element — Fragments are not valid.
   */
  children: React.ReactElement;
};

export function DeleteBatchDialog({
  runId,
  label,
  redirectTo,
  children,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `delete failed (${res.status})`);
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  const target = label?.trim() ? `“${label.trim()}”` : "this batch";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent
        className="bg-paper text-ink ring-line"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-[22px] leading-[1.2] tracking-[-0.005em] text-ink">
            Delete {target}?
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-[1.5] text-ink-3">
            This permanently removes the batch and every image in it. Generated
            images can&rsquo;t be recovered. Spent credits won&rsquo;t be refunded.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-[13px] leading-[1.4] text-terracotta">{error}</p>
        ) : null}

        <DialogFooter className="flex flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink-4 hover:bg-paper-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
