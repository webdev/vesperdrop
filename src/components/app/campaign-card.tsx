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

const HERO_ASPECT_MULTI = "aspect-[5/4]";
const HERO_ASPECT_SINGLE = "aspect-[16/9]";

// Multi-image rows cap at 2 supporting tiles + an optional "+N more" chip.
// Keeping the cluster tight is what lets the hero hold 45–60% of the strip
// width per the Editorial Row spec (components.md).
const MULTI_SUPPORTING_LIMIT = 2;

// Threshold for which secondary CTA to show. Few images → suggest expanding
// the batch ("Complete the look"). More images → suggest reapplying the
// recipe to a new product ("Use this style").
const COMPLETE_LOOK_THRESHOLD = 5;

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
  const isSingle = hasHero && totalCount === 1;

  const visibleSupporting = supporting.slice(0, MULTI_SUPPORTING_LIMIT);
  const moreCount = Math.max(
    0,
    totalCount - (hasHero ? 1 : 0) - visibleSupporting.length,
  );
  const showMore = moreCount > 0;

  // Hero flex weight tuned per cluster shape so it stays visually dominant
  // without making the lone supporting tile a thin sliver in the 2-image
  // edge case. Spec window per components.md is 45–60%.
  //   2 images (hero + 1 supp, no more):    flex-2 → ~67% hero
  //   dense   (hero + 2 supp + maybe more): flex-4 → 57–67% hero
  const heroFlex =
    visibleSupporting.length === 1 && !showMore ? "flex-[2]" : "flex-[4]";

  const secondaryCta =
    totalCount > COMPLETE_LOOK_THRESHOLD ? "use-style" : "complete-look";

  const headerNode = (
    <header className="flex flex-col md:w-[320px] md:shrink-0">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
        <span>{date}</span>
        <span aria-hidden className="px-2 text-line">·</span>
        <span>{meta}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-serif text-[clamp(1.75rem,2.2vw,2.125rem)] leading-[1.05] tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {pill ? (
          <Pill tone={pill.tone ?? "neutral"} className="tracking-[0.12em]">
            {pill.label}
          </Pill>
        ) : null}
      </div>
      {description ? (
        <p className="mt-5 line-clamp-2 max-w-[280px] text-[14px] leading-[1.55] text-ink-3">
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
      <div className="mt-7 flex flex-wrap items-center gap-2">
        <Link
          href={`/app/runs/${runId}`}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
        >
          View batch <span aria-hidden>→</span>
        </Link>
        {secondaryCta === "complete-look" ? (
          <Link
            href={`/app/runs/${runId}`}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink-4 hover:bg-paper-2"
          >
            Complete the look <PlusIcon />
          </Link>
        ) : (
          <Link
            href="/try"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink-4 hover:bg-paper-2"
          >
            Use this style <RefreshIcon />
          </Link>
        )}
        <Link
          href={`/app/runs/${runId}`}
          aria-label={`More options for ${title}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper-soft text-ink-3 transition-colors hover:border-ink-4 hover:text-ink"
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
          {isSingle ? (
            // ── CASE A — single image: cinematic wide hero ──
            <div
              className={`relative overflow-hidden rounded-md border border-line-soft bg-paper-2 ${HERO_ASPECT_SINGLE}`}
            >
              <Image
                src={hero!.url}
                alt={hero!.alt}
                fill
                sizes="(max-width: 768px) 100vw, 60vw"
                priority
                unoptimized
                className="object-cover object-[center_25%] transition-transform duration-700 group-hover:scale-[1.02]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/55 via-ink/15 to-transparent"
              />
              <span className="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cream/95 backdrop-blur-sm">
                <SparkleIcon />
                1 look generated
              </span>
            </div>
          ) : (
            // ── CASE B — multi-image: hero + supporting strip ──
            <div className="flex gap-1.5">
              <div
                className={`relative ${heroFlex} overflow-hidden rounded-md border border-line-soft bg-paper-2 ${HERO_ASPECT_MULTI}`}
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
          )}
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

function SparkleIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}
