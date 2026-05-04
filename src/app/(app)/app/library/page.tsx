import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { runs, generations, scenes } from "@/lib/db/schema";
import { CampaignCard, type CampaignTile } from "@/components/app/campaign-card";
import { LibraryEditorialStrip } from "@/components/app/library-editorial-strip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageShell } from "@/components/ui/page-shell";
import { ClaimHandler } from "./claim-handler";

// Insert an editorial break every N batch rows for rhythm.
const STRIP_EVERY = 3;

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(d: Date) {
  return DATE_FMT.format(d).toUpperCase();
}

function deriveTitle(run: { id: string; createdAt: Date }, sceneNames: string[]) {
  if (sceneNames.length === 0) return "Untitled batch";
  if (sceneNames.length === 1) return sceneNames[0]!;
  if (sceneNames.length === 2) return `${sceneNames[0]} & ${sceneNames[1]}`;
  return `${sceneNames[0]} + ${sceneNames.length - 1} more`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string }>;
}) {
  const { claim } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/app/library");

  const userRuns = await db
    .select()
    .from(runs)
    .where(eq(runs.userId, user.id))
    .orderBy(desc(runs.createdAt))
    .limit(50);

  const runIds = userRuns.map((r) => r.id);

  const gens = runIds.length
    ? await db
        .select()
        .from(generations)
        .where(inArray(generations.runId, runIds))
    : [];

  const sceneRows = await db
    .select({ slug: scenes.slug, name: scenes.name })
    .from(scenes);
  const sceneNameBySlug = new Map(sceneRows.map((s) => [s.slug, s.name]));

  const gensByRun = new Map<string, typeof gens>();
  for (const g of gens) {
    const arr = gensByRun.get(g.runId) ?? [];
    arr.push(g);
    gensByRun.set(g.runId, arr);
  }

  const claimMatched = claim && runIds.includes(claim) ? claim : null;

  // Hide runs that have no successful generations yet — they read as
  // empty rows in the editorial layout.
  const populatedRuns = userRuns.filter((run) => {
    const runGens = gensByRun.get(run.id) ?? [];
    return runGens.some((g) => g.status === "succeeded" && g.outputUrl);
  });

  return (
    <PageShell rhythm="loose">
      <ClaimHandler />

      <header className="relative -mx-4 rounded-2xl bg-gradient-to-b from-cream to-transparent px-4 pb-2 pt-6 md:-mx-6 md:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          Library
        </p>
        <h1 className="mt-3 font-serif text-[clamp(3.5rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.025em] text-ink">
          Your library
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-[1.55] text-ink-3">
          All your generated images in one place.
          <br />
          Reuse your styles, complete the look, or try something new.
        </p>
      </header>

      {populatedRuns.length > 0 ? <TopCreateCta /> : null}

      {populatedRuns.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-16">
          {populatedRuns.map((run, index) => {
            const runGens = gensByRun.get(run.id) ?? [];
            // Hero must be a top-level shot — LibraryCompleteLookButton can't
            // derive a pack from a pack shot. Supporting tiles can fall back
            // to pack shots so we still render the first 4 generated images
            // in larger batches.
            const topLevelSucceeded = runGens.filter(
              (g) => g.status === "succeeded" && g.outputUrl && !g.packId,
            );
            const allSucceeded = runGens.filter(
              (g) => g.status === "succeeded" && g.outputUrl,
            );
            const heroGen = topLevelSucceeded[0];
            const orderedGens = heroGen
              ? [heroGen, ...allSucceeded.filter((g) => g.id !== heroGen.id)]
              : allSucceeded;
            const totalSucceeded = allSucceeded.length;
            const watermarkedCount = runGens.filter((g) => g.watermarked).length;
            const allWatermarked =
              runGens.length > 0 && watermarkedCount === runGens.length;

            const sceneNamesForRun = Array.from(
              new Set(
                runGens
                  .map((g) => sceneNameBySlug.get(g.presetId) ?? null)
                  .filter((v): v is string => Boolean(v)),
              ),
            );

            const sourceCarrier = runGens.find(
              (g) =>
                g.sceneifySourceId &&
                (g.sceneifySourceId.startsWith("__local__/") ||
                  /^https?:\/\//i.test(g.sceneifySourceId)),
            );

            // Source is the raw upload — no focal point detected for it.
            const sourceTile: CampaignTile | null = sourceCarrier
              ? {
                  id: `${sourceCarrier.id}-source`,
                  url: `/api/images/${sourceCarrier.id}?type=source`,
                  alt: "Source product photo",
                }
              : null;

            const tiles: CampaignTile[] = orderedGens.map((g) => ({
              id: g.id,
              url: `/api/images/${g.id}`,
              alt: sceneNameBySlug.get(g.presetId) ?? g.presetId,
              focalPoint: g.focalPoint,
              faceBox: g.faceBox,
            }));

            const [hero, ...rest] = tiles;
            const supporting = rest.slice(0, 3);

            const meta = allWatermarked
              ? `${runGens.length} ${runGens.length === 1 ? "preview" : "previews"} · watermarked`
              : `${totalSucceeded} ${totalSucceeded === 1 ? "image" : "images"}`;

            // Rotate visual patterns deterministically by index — every
            // other multi-image row gets the stacked variant for editorial
            // rhythm. Single-image batches still use the cinematic hero
            // regardless (CampaignCard handles that internally).
            const layoutPattern: "horizontal" | "stacked" =
              index % 2 === 1 ? "stacked" : "horizontal";

            // Editorial break inserted AFTER every Nth batch row (so it
            // appears between rows, never at the top or as the last item).
            const showStripAfter =
              (index + 1) % STRIP_EVERY === 0 && index < populatedRuns.length - 1;
            const stripIndex = Math.floor(index / STRIP_EVERY);

            return (
              <Fragment key={run.id}>
                {index > 0 ? (
                  <li aria-hidden className="h-px">
                    <div
                      className="h-px w-full"
                      style={{
                        background:
                          "linear-gradient(to right, transparent, var(--color-line) 20%, var(--color-line) 80%, transparent)",
                        opacity: 0.55,
                      }}
                    />
                  </li>
                ) : null}
                <li>
                  <CampaignCard
                    runId={run.id}
                    customName={run.name}
                    fallbackTitle={deriveTitle(run, sceneNamesForRun)}
                    date={formatDate(new Date(run.createdAt))}
                    meta={meta.toUpperCase()}
                    hero={hero ?? null}
                    supporting={supporting}
                    source={sourceTile}
                    totalCount={totalSucceeded}
                    layoutPattern={layoutPattern}
                    pill={
                      allWatermarked
                        ? { label: "Preview", tone: "accent" }
                        : totalSucceeded > 0
                          ? { label: "HD", tone: "neutral" }
                          : null
                    }
                    description={
                      sceneNamesForRun.length > 1
                        ? sceneNamesForRun.slice(0, 3).join(" · ")
                        : null
                    }
                    highlightLabel={
                      claimMatched === run.id
                        ? "Your first batch is saved"
                        : null
                    }
                  />
                </li>
                {showStripAfter ? (
                  <li aria-hidden>
                    <LibraryEditorialStrip index={stripIndex} />
                  </li>
                ) : null}
              </Fragment>
            );
          })}
        </ul>
      )}

      {populatedRuns.length > 0 ? <ExploreFooter /> : null}
    </PageShell>
  );
}

// Top-of-library conversion band. Restrained — meant to read as part of
// the product, not a marketing banner. Mirrors the bottom CTA's layout
// so the page bookends consistently.
function TopCreateCta() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-[24px] border border-line-soft bg-paper-soft px-6 py-4 md:flex-row md:items-center md:gap-6 md:px-7 md:py-5">
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta-wash text-terracotta"
      >
        <SparkIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-[clamp(1.125rem,1.4vw,1.25rem)] leading-[1.25] tracking-[-0.005em] text-ink">
          Create something new
        </p>
        <p className="mt-1 text-[13px] leading-[1.5] text-ink-3">
          Turn any product into a complete campaign in seconds.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/try"
          className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink md:inline-flex"
        >
          Upload product
        </Link>
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
        >
          Create new look <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}

function ExploreFooter() {
  return (
    <section className="flex flex-col items-start gap-5 rounded-[24px] border border-line-soft bg-paper-soft px-6 py-6 md:flex-row md:items-center md:gap-10 md:px-8 md:py-8">
      <span
        aria-hidden
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terracotta-wash text-terracotta-dark"
      >
        <SparkIcon size={22} />
      </span>
      <div className="flex-1">
        <h2 className="font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.2] tracking-[-0.01em] text-ink">
          Build your next campaign
        </h2>
        <p className="mt-2 max-w-[520px] text-[14px] leading-[1.55] text-ink-3">
          Create variations, explore scenes, or generate a full set.
        </p>
      </div>
      <Link
        href="/app"
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-6 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
      >
        Create new look <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

function SparkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10z" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-line bg-surface p-12 text-center">
      <Eyebrow>Empty library</Eyebrow>
      <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink">
        No batches yet — drop a product to develop your first.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[14px] leading-[1.6] text-ink-3">
        Upload a single product photo, pick the scenes you want, and we’ll
        generate the full lifestyle batch in about ninety seconds.
      </p>
      <Link
        href="/try"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-cream transition-colors hover:bg-terracotta-dark"
      >
        Start a batch <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
