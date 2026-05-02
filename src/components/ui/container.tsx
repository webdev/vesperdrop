import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared content container.
 *
 *   app       — 1180px : authenticated app pages, headers, /try chrome
 *   marketing — 1280px : marketing pages and chrome
 *   reading   —  760px : long-form content (FAQs, closing CTAs, narrow heroes)
 *
 * Horizontal padding is part of the container so every consumer pays the same
 * cost — 20px on mobile, 32px on desktop. Use this everywhere; do not add
 * `mx-auto max-w-...` ad-hoc.
 */
export type ContainerWidth = "app" | "marketing" | "reading";

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  width?: ContainerWidth;
  as?: "div" | "section" | "header" | "footer" | "main" | "nav" | "aside";
};

const WIDTHS: Record<ContainerWidth, string> = {
  app: "max-w-[1180px]",
  marketing: "max-w-[1280px]",
  reading: "max-w-[760px]",
};

export function Container({
  width = "app",
  as: Tag = "div",
  className,
  ...props
}: ContainerProps) {
  return (
    <Tag
      className={cn("mx-auto w-full px-5 md:px-8", WIDTHS[width], className)}
      {...props}
    />
  );
}
