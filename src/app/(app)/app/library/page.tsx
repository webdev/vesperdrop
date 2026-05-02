import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { runs, generations, scenes } from "@/lib/db/schema";
import { CampaignCard, type CampaignTile } from "@/components/app/campaign-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageShell } from "@/components/ui/page-shell";
import { ClaimHandler } from "./claim-handler";

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

      <header>
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

      {populatedRuns.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-16">
          {populatedRuns.map((run) => {
            const runGens = gensByRun.get(run.id) ?? [];
            const succeeded = runGens.filter(
              (g) => g.status === "succeeded" && g.outputUrl,
            );
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

            const sourceTile: CampaignTile | null = sourceCarrier
              ? {
                  id: `${sourceCarrier.id}-source`,
                  url: `/api/images/${sourceCarrier.id}?type=source`,
                  alt: "Source product photo",
                }
              : null;

            const tiles: CampaignTile[] = succeeded.map((g) => ({
              id: g.id,
              url: `/api/images/${g.id}`,
              alt: sceneNameBySlug.get(g.presetId) ?? g.presetId,
            }));

            const [hero, ...rest] = tiles;
            const supporting = rest.slice(0, 3);

            const meta = allWatermarked
              ? `${runGens.length} ${runGens.length === 1 ? "preview" : "previews"} · watermarked`
              : `${succeeded.length} ${succeeded.length === 1 ? "image" : "images"}`;

            return (
              <li key={run.id}>
                <CampaignCard
                  runId={run.id}
                  title={deriveTitle(run, sceneNamesForRun)}
                  date={formatDate(new Date(run.createdAt))}
                  meta={meta.toUpperCase()}
                  hero={hero ?? null}
                  supporting={supporting}
                  source={sourceTile}
                  totalCount={succeeded.length}
                  pill={
                    allWatermarked
                      ? { label: "Preview", tone: "accent" }
                      : succeeded.length > 0
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
            );
          })}
        </ul>
      )}

      {populatedRuns.length > 0 ? <ExploreFooter /> : null}
    </PageShell>
  );
}

function ExploreFooter() {
  return (
    <section className="flex flex-col items-start gap-5 rounded-xl border border-line-soft bg-paper-soft px-6 py-5 md:flex-row md:items-center md:gap-8 md:px-7 md:py-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terracotta-wash text-terracotta-dark">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10z" />
        </svg>
      </div>
      <div className="flex-1">
        <h2 className="font-serif text-[clamp(1.25rem,1.6vw,1.5rem)] leading-[1.2] tracking-[-0.005em] text-ink">
          More looks to explore
        </h2>
        <p className="mt-1.5 max-w-[480px] text-[14px] leading-[1.5] text-ink-3">
          Create more variations, explore new scenes, or build a complete
          campaign.
        </p>
      </div>
      <Link
        href="/app"
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
      >
        Create new look <span aria-hidden>→</span>
      </Link>
    </section>
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
