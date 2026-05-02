import * as React from "react";
import { cn } from "@/lib/utils";

export type PillTone = "neutral" | "accent" | "ink" | "soft";

type PillProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: PillTone;
  size?: "sm" | "md";
};

const TONES: Record<PillTone, string> = {
  neutral: "border-line bg-paper-2 text-ink-2",
  accent: "border-terracotta/30 bg-terracotta/10 text-terracotta",
  ink: "border-ink bg-ink text-cream",
  soft: "border-line-soft bg-paper-soft text-ink-3",
};

export function Pill({
  className,
  tone = "neutral",
  size = "sm",
  ...props
}: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-mono uppercase tracking-[0.18em]",
        size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
