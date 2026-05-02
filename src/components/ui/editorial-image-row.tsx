import * as React from "react";
import { ImageCard, type ImageCardAspect } from "@/components/ui/image-card";
import { cn } from "@/lib/utils";

export type EditorialTile = {
  id: string;
  url: string;
  alt: string;
};

type EditorialImageRowProps = {
  hero: EditorialTile | null;
  supporting: EditorialTile[];
  moreCount?: number;
  className?: string;
  heroAspect?: ImageCardAspect;
  supportingAspect?: ImageCardAspect;
  captionFor?: (tile: EditorialTile, index: number) => React.ReactNode;
};

const SUPPORTING_ASPECT_BG: Record<ImageCardAspect, string> = {
  portrait: "aspect-[4/5]",
  tall: "aspect-[3/4]",
  square: "aspect-square",
  landscape: "aspect-[5/4]",
};

const TEMPLATES: Record<string, string> = {
  // hero + n supporting + optional more
  "1-3-1": "md:grid-cols-[2.2fr_1fr_1fr_1fr_0.7fr]",
  "1-3-0": "md:grid-cols-[2.2fr_1fr_1fr_1fr]",
  "1-2-1": "md:grid-cols-[2.4fr_1fr_1fr_0.7fr]",
  "1-2-0": "md:grid-cols-[2.4fr_1fr_1fr]",
  "1-1-1": "md:grid-cols-[2.6fr_1fr_0.8fr]",
  "1-1-0": "md:grid-cols-[2.6fr_1fr]",
  "1-0-1": "md:grid-cols-[3fr_1fr]",
  "1-0-0": "md:grid-cols-[1fr]",
  "0-3-1": "md:grid-cols-[1fr_1fr_1fr_0.7fr]",
  "0-3-0": "md:grid-cols-[1fr_1fr_1fr]",
};

export function EditorialImageRow({
  hero,
  supporting,
  moreCount = 0,
  className,
  heroAspect = "tall",
  supportingAspect = "portrait",
  captionFor,
}: EditorialImageRowProps) {
  const supportingShown = supporting.slice(0, 3);
  const showMore = moreCount > 0;

  const key = `${hero ? 1 : 0}-${supportingShown.length}-${showMore ? 1 : 0}`;
  const cols = TEMPLATES[key] ?? "md:grid-cols-[2.2fr_1fr_1fr_1fr]";

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 md:gap-4",
        cols,
        className,
      )}
    >
      {hero ? (
        <figure className="col-span-2 md:col-span-1">
          <ImageCard
            src={hero.url}
            alt={hero.alt}
            aspect={heroAspect}
            priority
            rounded="md"
            sizes="(max-width: 768px) 100vw, 40vw"
          />
          {captionFor ? (
            <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              {captionFor(hero, 0)}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      {supportingShown.map((tile, i) => (
        <figure key={tile.id} className="col-span-1">
          <ImageCard
            src={tile.url}
            alt={tile.alt}
            aspect={supportingAspect}
            rounded="md"
            sizes="(max-width: 768px) 50vw, 18vw"
          />
          {captionFor ? (
            <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              {captionFor(tile, i + 1)}
            </figcaption>
          ) : null}
        </figure>
      ))}

      {showMore ? (
        <div
          className={cn(
            "col-span-1 flex items-center justify-center rounded-md border border-line-soft bg-paper-2",
            SUPPORTING_ASPECT_BG[supportingAspect],
          )}
        >
          <div className="flex flex-col items-center gap-1 text-ink-2">
            <span className="font-serif text-[clamp(1.5rem,2vw,2rem)] leading-none">
              +{moreCount}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">
              more
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
