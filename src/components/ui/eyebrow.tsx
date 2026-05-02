import * as React from "react";
import { cn } from "@/lib/utils";

type EyebrowProps = React.HTMLAttributes<HTMLSpanElement> & {
  accent?: boolean;
  as?: "span" | "div" | "p";
};

export function Eyebrow({
  className,
  accent = false,
  as: Tag = "span",
  ...props
}: EyebrowProps) {
  return (
    <Tag
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.18em]",
        accent ? "text-terracotta" : "text-ink-3",
        className,
      )}
      {...props}
    />
  );
}
