import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type FigureProps = {
  src: string;
  alt: string;
  caption?: React.ReactNode;
  badge?: "hd" | "preview" | "source" | null;
  href?: string;
  ratio?: "square" | "portrait" | "landscape" | "tall";
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  unoptimized?: boolean;
};

const RATIO: Record<NonNullable<FigureProps["ratio"]>, string> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  landscape: "aspect-[4/3]",
  tall: "aspect-[3/4]",
};

const BADGE_LABEL: Record<NonNullable<FigureProps["badge"]>, string> = {
  hd: "HD",
  preview: "Preview",
  source: "Source",
};

export function Figure({
  src,
  alt,
  caption,
  badge,
  href,
  ratio = "portrait",
  priority,
  className,
  imageClassName,
  unoptimized,
}: FigureProps) {
  const frame = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-line bg-paper-2",
        RATIO[ratio],
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
        priority={priority}
        unoptimized={unoptimized}
        className={cn(
          "object-cover transition-transform duration-500 group-hover:scale-[1.015]",
          imageClassName,
        )}
      />
      {badge ? (
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
            badge === "hd"
              ? "bg-ink/85 text-cream"
              : badge === "preview"
                ? "bg-cream/90 text-ink-2"
                : "bg-paper/85 text-ink-3",
          )}
        >
          {BADGE_LABEL[badge]}
        </span>
      ) : null}
    </div>
  );

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      {href ? (
        <Link href={href} aria-label={alt} className="block">
          {frame}
        </Link>
      ) : (
        frame
      )}
      {caption ? (
        <figcaption className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
