import * as React from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  meta?: React.ReactNode;
  align?: "left" | "center";
  size?: "page" | "section";
  className?: string;
  children?: React.ReactNode;
};

const TITLE_SIZE = {
  page: "text-[clamp(2.5rem,5.5vw,4rem)] leading-[1.02]",
  section: "text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.08]",
} as const;

export function SectionHeader({
  eyebrow,
  title,
  lede,
  meta,
  align = "left",
  size = "page",
  className,
  children,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "space-y-4",
        align === "center" && "mx-auto max-w-2xl text-center",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1
        className={cn(
          "font-serif tracking-tight text-ink",
          TITLE_SIZE[size],
        )}
      >
        {title}
      </h1>
      {lede ? (
        <p className="max-w-xl text-[15px] leading-[1.6] text-ink-3">{lede}</p>
      ) : null}
      {meta ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
          {meta}
        </p>
      ) : null}
      {children}
    </header>
  );
}
