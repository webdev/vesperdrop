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

const HERO_ASPECT = "aspect-[5/4]";

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
  // Up to 4 supporting tiles inline next to the hero; if there's still
  // overflow, the 6th cell becomes a "+N more" chip.
  const visibleSupporting = supporting.slice(0, 4);
  const moreCount = Math.max(
    0,
    totalCount - (hasHero ? 1 : 0) - visibleSupporting.length,
  );
  const showMore = moreCount > 0;

  const headerNode = (
    <header className="flex flex-col md:w-[260px] md:shrink-0">
      <h2 className="font-serif text-[clamp(1.625rem,2vw,2rem)] leading-[1.05] tracking-[-0.01em] text-ink">
        {title}
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
        <span>{date}</span>
        <span aria-hidden className="text-line">·</span>
        <span>{meta}</span>
        {pill ? (
          <Pill tone={pill.tone ?? "neutral"} className="ml-1 tracking-[0.12em]">
            {pill.label}
          </Pill>
        ) : null}
      </div>
      {description ? (
        <p className="mt-4 line-clamp-2 text-[14px] leading-[1.55] text-ink-3">
          {description}
        </p>
      ) : null}
      {source ? (
        <div className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
            Source
          </p>
          <Link
            href={`/app/runs/${runId}`}
            aria-label={`Source photo for ${title}`}
            className="mt-2 block w-[88px] overflow-hidden rounded-md border border-line-soft bg-paper-2 transition-colors hover:border-ink-4"
          >
            <div className="relative aspect-[4/5]">
              <Image
                src={source.url}
                alt={source.alt}
                fill
                sizes="88px"
                unoptimized
                className="object-cover"
              />
            </div>
          </Link>
        </div>
      ) : null}
      <div className="mt-6 flex items-center gap-2">
        <Link
          href={`/app/runs/${runId}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-soft px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink-4 hover:bg-paper-2"
        >
          View batch <span aria-hidden>→</span>
        </Link>
        <Link
          href={`/app/runs/${runId}`}
          aria-label={`More options for ${title}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper-soft text-ink-3 transition-colors hover:border-ink-4 hover:text-ink"
        >
          <span aria-hidden className="leading-none">···</span>
        </Link>
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
            <Pill tone="soft" className="tracking-[0.12em]">
              No images yet
            </Pill>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="space-y-4">
      {highlightLabel ? <HighlightBanner label={highlightLabel} /> : null}

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-12">
        {headerNode}

        <Link
          href={`/app/runs/${runId}`}
          aria-label={`Open ${title}`}
          className="group block min-w-0 flex-1"
        >
          <div className="flex gap-1.5">
            <div
              className={`relative flex-[1.6] overflow-hidden rounded-md border border-line-soft bg-paper-2 ${HERO_ASPECT}`}
            >
              <Image
                src={hero!.url}
                alt={hero!.alt}
                fill
                sizes="(max-width: 768px) 60vw, 240px"
                priority
                unoptimized
                className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            </div>

            {visibleSupporting.map((tile) => (
              <div
                key={tile.id}
                className="relative flex-1 overflow-hidden rounded-md border border-line-soft bg-paper-2"
              >
                <Image
                  src={tile.url}
                  alt={tile.alt}
                  fill
                  sizes="(max-width: 768px) 30vw, 130px"
                  unoptimized
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                />
              </div>
            ))}

            {showMore ? (
              <div className="flex flex-1 items-center justify-center rounded-md border border-line-soft bg-paper-2">
                <div className="flex flex-col items-center gap-0.5 text-ink-2">
                  <span className="font-serif text-[clamp(1.25rem,1.6vw,1.625rem)] leading-none tracking-[-0.01em]">
                    +{moreCount}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
                    more
                  </span>
                </div>
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
