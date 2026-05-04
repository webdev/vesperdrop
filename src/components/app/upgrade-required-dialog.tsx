"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UpgradeRequiredDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-paper text-ink ring-line"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-[22px] leading-[1.2] tracking-[-0.005em] text-ink">
            Downloads are a paid perk
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-[1.5] text-ink-3">
            Free previews stay watermarked and view-only. Upgrade to grab
            full-resolution files — sized for Amazon, Shopify, and social.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink-4 hover:bg-paper-2"
          >
            Not now
          </button>
          <Link
            href="/pricing"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
          >
            See plans <span aria-hidden>→</span>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
