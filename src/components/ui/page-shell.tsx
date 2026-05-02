import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Vertical rhythm wrapper. Width containment is the layout's job (see
 * `Container`); this component only spaces sections inside a page.
 */
type PageShellProps = React.HTMLAttributes<HTMLDivElement> & {
  rhythm?: "default" | "tight" | "loose";
};

const RHYTHM = {
  tight: "space-y-8",
  default: "space-y-14",
  loose: "space-y-20",
} as const;

export function PageShell({
  className,
  rhythm = "default",
  ...props
}: PageShellProps) {
  return (
    <div
      className={cn("w-full", RHYTHM[rhythm], className)}
      {...props}
    />
  );
}
