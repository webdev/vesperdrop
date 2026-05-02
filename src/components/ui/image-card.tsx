import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type ImageCardAspect = "portrait" | "tall" | "square" | "landscape";

const ASPECTS: Record<ImageCardAspect, string> = {
  portrait: "aspect-[4/5]",
  tall: "aspect-[3/4]",
  square: "aspect-square",
  landscape: "aspect-[5/4]",
};

type ImageCardProps = {
  src: string;
  alt: string;
  aspect?: ImageCardAspect;
  priority?: boolean;
  rounded?: "sm" | "md" | "lg";
  className?: string;
  sizes?: string;
  hover?: boolean;
};

const ROUNDED = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
} as const;

export function ImageCard({
  src,
  alt,
  aspect = "portrait",
  priority,
  rounded = "md",
  className,
  sizes,
  hover = true,
}: ImageCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border border-line-soft bg-paper-2",
        ROUNDED[rounded],
        ASPECTS[aspect],
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"}
        priority={priority}
        unoptimized
        className={cn(
          "object-cover transition-transform duration-700",
          hover && "group-hover:scale-[1.03]",
        )}
      />
    </div>
  );
}
