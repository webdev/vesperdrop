import Link from "next/link";
import Image from "next/image";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Pill, type PillTone } from "@/components/ui/pill";

export type CampaignTile = {
  id: string;
  url: string;
  alt: string;
};

export type CampaignCardProps = {
  runId: string;
  title: string;
  date: string;
  meta: string;
  hero: CampaignTile | null;
  supporting: CampaignTile[];
  source: CampaignTile | null;
  totalCount: number;
  pill?: { label: string; tone?: PillTone } | null;
  description?: string | null;
  highlightLabel?: string | null;
};

const HERO_ASPECT = "aspect-[3/4]";

export function CampaignCard(props: CampaignCardProps) {
  const {
    runId,
    title,
    date,
    meta,
    hero,
    supporting,
    source,
    totalCount,
    pill,
    description,
    highlightLabel,
  } = props;

  const hasHero = Boolean(hero);
  const visibleSupporting = supporting.slice(0, 2);
  const moreCount = Math.max(
    0,
    totalCount - (hasHero ? 1 : 0) - visibleSupporting.length,
  );

  type StackCell =
    | { kind: "tile"; tile: CampaignTile }
    | { kind: "more"; count: number };
  const stack: StackCell[] = [];
  if (visibleSupporting[0]) stack.push({ kind: "tile", tile: visibleSupporting[0] });
  if (moreCount > 0) {
    stack.push({ kind: "more", count: moreCount });
  } else if (visibleSupporting[1]) {
    stack.push({ kind: "tile", tile: visibleSupporting[1] });
  }

  const headerNode = (
    <header className="flex flex-col md:w-[260px] md:shrink-0">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
        {date}
      </p>
      <h2 className="mt-2 font-serif text-[clamp(1.375rem,1.8vw,1.625rem)] leading-[1.15] tracking-[-0.01em] text-ink">
        {title}
      </h2>
      {pill ? (
        <div className="mt-4">
          <Pill tone={pill.tone ?? "neutral"} className="tracking-[0.12em]">
            {pill.label}
          </Pill>
        </div>
      ) : null}
      {description ? (
        <p className="mt-3 text-[14px] leading-[1.55] tracking-[0.02em] text-ink-3">
          {description}
        </p>
      ) : null}
      <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-4">
        {meta}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={`/app/runs/${runId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
        >
          View batch <span aria-hidden>→</span>
        </Link>
        {source ? <SourceThumb src={source.url} alt={source.alt} /> : null}
      </div>
    </header>
  );

  if (!hasHero) {
    return (
      <article className="space-y-4">
        {highlightLabel ? <HighlightBanner label={highlightLabel} /> : null}
        <div className="flex items-center justify-between gap-6 border-b border-line-soft pb-6">
          {headerNode}
          <div className="hidden text-right md:block">
            <Pill tone="soft" className="tracking-[0.12em]">No images yet</Pill>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="space-y-4">
      {highlightLabel ? <HighlightBanner label={highlightLabel} /> : null}

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-7 lg:gap-8">
        {headerNode}

        <Link
          href={`/app/runs/${runId}`}
          aria-label={`Open ${title}`}
          className="group block min-w-0 flex-1 lg:flex-none"
        >
          <div className="flex gap-2">
            <div
              className={`relative flex-[3] overflow-hidden rounded-lg border border-line-soft bg-paper-2 lg:w-[420px] lg:flex-none ${HERO_ASPECT}`}
            >
              <Image
                src={hero!.url}
                alt={hero!.alt}
                fill
                sizes="(max-width: 768px) 100vw, 420px"
                priority
                unoptimized
                className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            </div>

            {stack.length > 0 ? (
              <div className="flex flex-[2] flex-col gap-2 lg:w-[140px] lg:flex-none">
                {stack.map((cell, i) =>
                  cell.kind === "tile" ? (
                    <div
                      key={cell.tile.id}
                      className="relative flex-1 overflow-hidden rounded-lg border border-line-soft bg-paper-2"
                    >
                      <Image
                        src={cell.tile.url}
                        alt={cell.tile.alt}
                        fill
                        sizes="(max-width: 768px) 50vw, 140px"
                        unoptimized
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div
                      key={`more-${i}`}
                      className="flex flex-1 items-center justify-center rounded-lg border border-line-soft bg-paper-2"
                    >
                      <div className="flex flex-col items-center gap-1 text-ink-2">
                        <span className="font-serif text-[clamp(1.375rem,1.8vw,1.625rem)] leading-none tracking-[-0.01em]">
                          +{cell.count}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
                          more
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : null}
          </div>
        </Link>
      </div>
    </article>
  );
}

function HighlightBanner({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-terracotta/30 bg-terracotta-wash px-4 py-2.5">
      <Eyebrow accent className="tracking-[0.12em]">
        {label}
      </Eyebrow>
    </div>
  );
}

function SourceThumb({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-paper-soft py-1 pl-1 pr-3">
      <span className="relative h-7 w-7 overflow-hidden rounded-full">
        <Image src={src} alt={alt} fill sizes="28px" unoptimized className="object-cover" />
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Source
      </span>
    </span>
  );
}
