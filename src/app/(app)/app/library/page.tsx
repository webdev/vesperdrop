import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { runs, generations, scenes } from "@/lib/db/schema";
import { CampaignCard, type CampaignTile } from "@/components/app/campaign-card";
import { Eyebrow } from "@/components/ui/eyebrow";
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
    <div className="w-full space-y-20 md:space-y-24">
      <ClaimHandler />

      <header>
        <h1 className="font-serif text-[clamp(4rem,7vw,5.5rem)] leading-[0.95] tracking-[-0.025em] text-ink">
          Your library
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-[1.55] text-ink-3">
          All your generated images in one place.
        </p>
      </header>

      {populatedRuns.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-16 md:space-y-20">
          {populatedRuns.map((run, idx) => {
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
              <li
                key={run.id}
                className={
                  idx === 0
                    ? undefined
                    : "border-t border-line-soft pt-16 md:pt-20"
                }
              >
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
    </div>
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
