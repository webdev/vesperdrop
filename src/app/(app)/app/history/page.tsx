import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { runs, generations, scenes } from "@/lib/db/schema";
import { ClaimHandler } from "./claim-handler";
import { RunFigure } from "@/components/app/run-figure";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(d: Date) {
  return DATE_FMT.format(d).toUpperCase();
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
  if (!user) redirect("/sign-in?next=/app/history");

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

  return (
    <div className="space-y-10">
      <ClaimHandler />
      <header>
        <h1 className="text-[clamp(2rem,4vw,3rem)] leading-tight">
          Your <em className="italic">batches</em>
        </h1>
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-500 mt-2">
          {userRuns.length} {userRuns.length === 1 ? "run" : "runs"} · most recent first
        </p>
      </header>

      {userRuns.length === 0 ? (
        <div className="border border-zinc-200 bg-white rounded p-12 text-center max-w-xl mx-auto">
          <p className="text-xl italic  text-zinc-700">
            No batches yet — drop a product to develop your first.
          </p>
          <Link
            href="/try"
            className="inline-block mt-6 bg-zinc-900 text-white px-6 py-3 font-mono text-xs tracking-[0.18em] uppercase hover:bg-orange-500 transition-colors"
          >
            Start a batch →
          </Link>
        </div>
      ) : (
        <ul className="space-y-12">
          {userRuns.map((run) => {
            const runGens = gensByRun.get(run.id) ?? [];
            const succeeded = runGens.filter(
              (g) => g.status === "succeeded" && g.outputUrl,
            );
            const watermarkedCount = runGens.filter((g) => g.watermarked).length;
            const allWatermarked =
              runGens.length > 0 && watermarkedCount === runGens.length;
            const qualityLabel = allWatermarked
              ? `${runGens.length} ${runGens.length === 1 ? "PREVIEW" : "PREVIEWS"} · WATERMARKED`
              : `${runGens.length} ${runGens.length === 1 ? "HD" : "HD"}`;
            const isClaimed = claimMatched === run.id;
            const sourceCarrier = runGens.find(
              (g) =>
                g.sceneifySourceId &&
                (g.sceneifySourceId.startsWith("__local__/") ||
                  /^https?:\/\//i.test(g.sceneifySourceId)),
            );
            const sourceProxyUrl = sourceCarrier
              ? `/api/images/${sourceCarrier.id}?type=source`
              : null;
            return (
              <li key={run.id} className="space-y-3">
                {isClaimed ? (
                  <div className="border border-orange-500/40 bg-orange-500/5 px-4 py-3 rounded">
                    <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-orange-500">
                      Your first batch is saved.
                    </p>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-2">
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-700">
                    {formatDate(new Date(run.createdAt))}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-500">
                    {qualityLabel}
                  </div>
                </div>
                {succeeded.length === 0 ? (
                  <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-zinc-500 py-4">
                    No completed images
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {sourceProxyUrl && sourceCarrier ? (
                      <RunFigure
                        runId={run.id}
                        generationId={sourceCarrier.id}
                        imageUrl={sourceProxyUrl}
                        downloadUrl={sourceProxyUrl}
                        alt="Your product"
                        caption="SOURCE"
                        watermarked={false}
                        hasSceneifyId={false}
                        isSource
                      />
                    ) : null}
                    {succeeded.map((g) => {
                      const baseCaption =
                        sceneNameBySlug.get(g.presetId) ?? g.presetId;
                      const caption = g.packRole
                        ? `PACK · ${g.packRole.toUpperCase()}`
                        : baseCaption;
                      const proxyUrl = `/api/images/${g.id}`;
                      const downloadUrl = `${proxyUrl}?download=1`;
                      return (
                        <RunFigure
                          key={g.id}
                          runId={g.runId}
                          generationId={g.id}
                          imageUrl={proxyUrl}
                          downloadUrl={downloadUrl}
                          alt={caption}
                          caption={caption}
                          watermarked={g.watermarked}
                          hasSceneifyId={Boolean(g.sceneifyGenerationId)}
                          isPackShot={Boolean(g.packId)}
                        />
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
