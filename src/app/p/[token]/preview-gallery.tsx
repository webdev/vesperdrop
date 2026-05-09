"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { FaceSafeImage } from "@/components/ui/face-safe-image";
import { cn } from "@/lib/utils";
import type {
  PreviewGeneratedImage,
  PreviewOriginalImage,
} from "@/lib/preview-pages/loader";
import { PreviewLightbox } from "./preview-lightbox";

type Props = {
  originals: PreviewOriginalImage[];
  generatedBySource: Map<number, PreviewGeneratedImage[]>;
  excludeUrls: Set<string>;
  isMulti: boolean;
};

export function CampaignGallery({
  originals,
  generatedBySource,
  excludeUrls,
  isMulti,
}: Props) {
  const productGalleries = useMemo(() => {
    return originals.map((original, sourceIndex) => {
      const all = generatedBySource.get(sourceIndex) ?? [];
      let visible = all.filter((g) => !excludeUrls.has(g.url));
      if (visible.length === 0 && !isMulti && all.length > 0) {
        visible = all.slice(0, Math.min(2, all.length));
      }
      return { original, sourceIndex, generated: visible };
    });
  }, [originals, generatedBySource, excludeUrls, isMulti]);

  const flat = useMemo(
    () => productGalleries.flatMap((p) => p.generated),
    [productGalleries],
  );

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (productGalleries.every((p) => p.generated.length === 0)) return null;

  return (
    <section className="pt-5 pb-7 md:pt-7 md:pb-10">
      <div className="mb-5 flex items-baseline justify-between gap-4 md:mb-7">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
            Campaign preview
          </p>
          <h2 className="mt-1.5 max-w-[28ch] font-serif text-[clamp(1.4rem,2vw,1.85rem)] leading-[1.1] tracking-[-0.018em] text-ink">
            The full editorial set.
          </h2>
        </div>
        <p className="hidden font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4 sm:block">
          Click any image to inspect
        </p>
      </div>

      <div className="flex flex-col gap-y-10 md:gap-y-12">
        {productGalleries.map((p, rowIdx) => {
          if (p.generated.length === 0) return null;
          const startIdx = productGalleries
            .slice(0, rowIdx)
            .reduce((acc, x) => acc + x.generated.length, 0);
          const productLabel = `${String(rowIdx + 1).padStart(2, "0")} / ${String(productGalleries.length).padStart(2, "0")}`;
          return (
            <div
              key={rowIdx}
              className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[160px_minmax(0,1fr)] md:gap-x-12"
            >
              <ReferenceCard
                original={p.original}
                productLabel={productLabel}
                rowIdx={rowIdx}
              />
              <EditorialRow
                items={p.generated}
                startIndex={startIdx}
                onOpen={setOpenIndex}
                productIndex={rowIdx}
              />
            </div>
          );
        })}
      </div>

      <PreviewLightbox
        images={flat}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onNavigate={setOpenIndex}
      />
    </section>
  );
}

function ReferenceCard({
  original,
  productLabel,
  rowIdx,
}: {
  original: PreviewOriginalImage;
  productLabel: string;
  rowIdx: number;
}) {
  const tilt = rowIdx % 2 === 0 ? "-rotate-[0.4deg]" : "rotate-[0.5deg]";
  return (
    <div className="md:sticky md:top-8 md:self-start">
      <div className={cn("relative w-[140px] md:w-[150px]", tilt)}>
        <span className="absolute -right-2 -top-1 z-10 rotate-3 border border-line-soft/70 bg-paper px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.22em] text-ink-4">
          Original
        </span>
        <div className="overflow-hidden rounded-[16px] border border-line-soft/70 bg-[oklch(0.92_0.012_70)] ring-1 ring-paper shadow-[0_4px_12px_-6px_rgba(40,30,20,0.18)]">
          <Image
            src={original.url}
            alt={original.alt ?? "Reference"}
            width={300}
            height={375}
            className="aspect-[4/5] w-full object-cover saturate-[0.9]"
            unoptimized
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
            Reference
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
            {productLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

type Pattern = "A" | "B" | "C";

function EditorialRow({
  items,
  startIndex,
  onOpen,
  productIndex,
}: {
  items: PreviewGeneratedImage[];
  startIndex: number;
  onOpen: (i: number) => void;
  productIndex: number;
}) {
  if (items.length === 1) {
    return (
      <FullBleedSingle
        item={items[0]!}
        startIndex={startIndex}
        onOpen={onOpen}
      />
    );
  }
  if (items.length === 2) {
    return (
      <PatternC items={items} startIndex={startIndex} onOpen={onOpen} />
    );
  }
  const pattern: Pattern = (["A", "B", "C"] as const)[productIndex % 3]!;
  if (pattern === "A") {
    return <PatternA items={items} startIndex={startIndex} onOpen={onOpen} />;
  }
  if (pattern === "B") {
    return <PatternB items={items} startIndex={startIndex} onOpen={onOpen} />;
  }
  return <PatternC items={items} startIndex={startIndex} onOpen={onOpen} />;
}

function pickByAspect(
  items: PreviewGeneratedImage[],
  preferred: PreviewGeneratedImage["aspect"],
): { picked: PreviewGeneratedImage; rest: PreviewGeneratedImage[] } {
  const idx = items.findIndex((it) => it.aspect === preferred);
  if (idx === -1) return { picked: items[0]!, rest: items.slice(1) };
  return {
    picked: items[idx]!,
    rest: [...items.slice(0, idx), ...items.slice(idx + 1)],
  };
}

function FullBleedSingle({
  item,
  startIndex,
  onOpen,
}: {
  item: PreviewGeneratedImage;
  startIndex: number;
  onOpen: (i: number) => void;
}) {
  return (
    <div>
      <CardButton
        img={item}
        index={startIndex}
        onOpen={onOpen}
        aspect={aspectClassFor(item.aspect)}
        sizeClass="rounded-[28px]"
        delayMs={120}
      />
    </div>
  );
}

function PatternA({
  items,
  startIndex,
  onOpen,
}: {
  items: PreviewGeneratedImage[];
  startIndex: number;
  onOpen: (i: number) => void;
}) {
  const { picked: landscape, rest } = pickByAspect(items, "landscape");
  const inset = rest[0] ?? items[1]!;
  const overflow = rest.slice(1);
  const landscapeIdx = items.indexOf(landscape);
  const insetIdx = items.indexOf(inset);
  return (
    <div className="grid grid-cols-12 gap-3 md:gap-5">
      <div className="relative col-span-12 md:col-span-9 md:-mx-2">
        <CardButton
          img={landscape}
          index={startIndex + landscapeIdx}
          onOpen={onOpen}
          aspect={aspectClassFor(landscape.aspect ?? "landscape")}
          sizeClass="rounded-[28px]"
          delayMs={120}
        />
        <div className="pointer-events-none absolute -bottom-6 -right-3 hidden w-[34%] max-w-[260px] md:block">
          <div className="pointer-events-auto">
            <CardButton
              img={inset}
              index={startIndex + insetIdx}
              onOpen={onOpen}
              aspect={aspectClassFor(inset.aspect ?? "portrait")}
              sizeClass="rounded-[20px]"
              delayMs={220}
            />
          </div>
        </div>
        <div className="mt-3 md:hidden">
          <CardButton
            img={inset}
            index={startIndex + insetIdx}
            onOpen={onOpen}
            aspect={aspectClassFor(inset.aspect ?? "portrait")}
            sizeClass="rounded-[20px]"
            delayMs={220}
          />
        </div>
      </div>
      {overflow.length > 0 ? (
        <div className="col-span-12 md:col-span-3 md:translate-y-10">
          <CardButton
            img={overflow[0]!}
            index={startIndex + items.indexOf(overflow[0]!)}
            onOpen={onOpen}
            aspect="aspect-[4/5]"
            sizeClass="rounded-[20px]"
            delayMs={300}
          />
        </div>
      ) : null}
    </div>
  );
}

function PatternB({
  items,
  startIndex,
  onOpen,
}: {
  items: PreviewGeneratedImage[];
  startIndex: number;
  onOpen: (i: number) => void;
}) {
  const { picked: portrait, rest } = pickByAspect(items, "portrait");
  const detail = rest[0] ?? items[1]!;
  const overflow = rest.slice(1);
  const portraitIdx = items.indexOf(portrait);
  const detailIdx = items.indexOf(detail);
  return (
    <div className="grid grid-cols-12 gap-3 md:gap-5">
      <div className="col-span-12 md:col-span-7 md:-mx-2">
        <CardButton
          img={portrait}
          index={startIndex + portraitIdx}
          onOpen={onOpen}
          aspect={aspectClassFor(portrait.aspect ?? "portrait")}
          sizeClass="rounded-[28px]"
          delayMs={120}
        />
      </div>
      <div className="col-span-12 md:col-span-5 md:flex md:flex-col md:gap-5">
        <div className="md:translate-y-12 md:-mr-4 md:max-w-[280px] md:ml-auto">
          <CardButton
            img={detail}
            index={startIndex + detailIdx}
            onOpen={onOpen}
            aspect={aspectClassFor(detail.aspect ?? "square")}
            sizeClass="rounded-[20px]"
            delayMs={220}
          />
        </div>
        {overflow.length > 0 ? (
          <div className="md:translate-y-4">
            <CardButton
              img={overflow[0]!}
              index={startIndex + items.indexOf(overflow[0]!)}
              onOpen={onOpen}
              aspect={aspectClassFor(overflow[0]!.aspect ?? "landscape")}
              sizeClass="rounded-[24px]"
              delayMs={300}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PatternC({
  items,
  startIndex,
  onOpen,
}: {
  items: PreviewGeneratedImage[];
  startIndex: number;
  onOpen: (i: number) => void;
}) {
  const a = items[0]!;
  const b = items[1] ?? items[0]!;
  const overflow = items.slice(2);
  return (
    <div className="grid grid-cols-12 gap-3 md:gap-5">
      <div className="col-span-12 md:col-span-7 md:-mx-2 md:translate-y-2">
        <CardButton
          img={a}
          index={startIndex}
          onOpen={onOpen}
          aspect={aspectClassFor(a.aspect)}
          sizeClass="rounded-[28px]"
          delayMs={120}
        />
      </div>
      <div className="col-span-12 md:col-span-5 md:translate-y-10 md:scale-[0.92] md:origin-top">
        <CardButton
          img={b}
          index={startIndex + 1}
          onOpen={onOpen}
          aspect={aspectClassFor(b.aspect)}
          sizeClass="rounded-[24px]"
          delayMs={220}
        />
      </div>
      {overflow.map((img, i) => (
        <div
          key={img.url}
          className={cn(
            "col-span-12",
            i % 2 === 0 ? "md:col-span-7" : "md:col-span-5",
            i % 2 === 0 ? "md:translate-y-3" : "md:translate-y-8",
          )}
        >
          <CardButton
            img={img}
            index={startIndex + 2 + i}
            onOpen={onOpen}
            aspect={aspectClassFor(img.aspect)}
            sizeClass="rounded-[24px]"
            delayMs={300 + i * 80}
          />
        </div>
      ))}
    </div>
  );
}

function aspectClassFor(aspect: PreviewGeneratedImage["aspect"]): string {
  if (aspect === "portrait") return "aspect-[4/5]";
  if (aspect === "landscape") return "aspect-[7/5]";
  return "aspect-square";
}

function CardButton({
  img,
  index,
  onOpen,
  aspect,
  sizeClass,
  delayMs,
}: {
  img: PreviewGeneratedImage;
  index: number;
  onOpen: (i: number) => void;
  aspect: string;
  sizeClass: string;
  delayMs: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className="group relative block w-full cursor-zoom-in text-left transition-all duration-700 ease-out motion-safe:hover:-translate-y-1.5 motion-safe:hover:scale-[1.015]"
      aria-label={img.label ? `Open ${img.label}` : "Open image"}
    >
      <GeneratedCard
        image={img}
        aspect={aspect}
        sizeClass={sizeClass}
        delayMs={delayMs}
      />
    </button>
  );
}

function GeneratedCard({
  image,
  aspect,
  sizeClass,
  delayMs,
}: {
  image: PreviewGeneratedImage;
  aspect: string;
  sizeClass: string;
  delayMs: number;
}) {
  return (
    <figure
      className="relative motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-700"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div
        className={cn(
          "relative overflow-hidden border border-[oklch(0.86_0.015_70)]/60 bg-cream ring-1 ring-[oklch(0.92_0.012_70)]/80 ring-offset-1 ring-offset-paper shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_22px_50px_-32px_rgba(40,30,20,0.3)] transition-all duration-700 ease-out will-change-transform group-hover:shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_40px_80px_-36px_rgba(40,30,20,0.45)]",
          sizeClass,
        )}
      >
        <FaceSafeImage
          src={image.url}
          alt={image.label ?? "Generated image"}
          width={1200}
          height={1500}
          focalPoint={image.focalPoint ?? undefined}
          faceBox={image.faceBox ?? undefined}
          className={`${aspect} w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]`}
          unoptimized
        />
        {image.label ? (
          <span className="absolute left-3.5 top-3.5 rounded-full border border-line-soft bg-paper/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3 shadow-[0_8px_20px_-12px_rgba(40,30,20,0.25)] backdrop-blur-[1px]">
            {image.label.toUpperCase()}
          </span>
        ) : null}
      </div>
    </figure>
  );
}
