import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { runs, generations, scenes } from "@/lib/db/schema";
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
        <h1 className="font-serif text-[clamp(2rem,4vw,3rem)] leading-tight">
          Your <em className="italic">batches</em>
        </h1>
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-ink-3)] mt-2">
          {userRuns.length} {userRuns.length === 1 ? "run" : "runs"} · most recent first
        </p>
      </header>

      {userRuns.length === 0 ? (
        <div className="border border-[var(--color-line)] bg-[var(--color-cream)] rounded p-12 text-center max-w-xl mx-auto">
          <p className="font-serif text-xl italic font-light text-[var(--color-ink-2)]">
            No batches yet — drop a product to develop your first.
          </p>
          <Link
            href="/try"
            className="inline-block mt-6 bg-[var(--color-ink)] text-[var(--color-paper)] px-6 py-3 font-mono text-xs tracking-[0.18em] uppercase hover:bg-[var(--color-ember)] transition-colors"
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
                  <div className="border border-[var(--color-ember)]/40 bg-[var(--color-ember)]/5 px-4 py-3 rounded">
                    <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--color-ember)]">
                      Your first batch is saved.
                    </p>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-line)] pb-2">
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-ink-2)]">
                    {formatDate(new Date(run.createdAt))}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-ink-3)]">
                    {qualityLabel}
                  </div>
                </div>
                {succeeded.length === 0 ? (
                  <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--color-ink-3)] py-4">
                    No completed images
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {sourceProxyUrl ? (
                      <figure className="space-y-2">
                        <div className="relative block aspect-[4/5] overflow-hidden border border-[var(--color-ember)]/60 bg-[var(--color-paper-2)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={sourceProxyUrl}
                            alt="Your product"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 left-2 font-mono text-[9px] tracking-[0.18em] uppercase bg-[var(--color-ember)] text-[var(--color-cream)] px-2 py-0.5">
                            Yours
                          </span>
                        </div>
                        <figcaption className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--color-ember)]">
                          Source
                        </figcaption>
                      </figure>
                    ) : null}
                    {succeeded.map((g) => {
                      const sceneName =
                        sceneNameBySlug.get(g.presetId) ?? g.presetId;
                      const proxyUrl = `/api/images/${g.id}`;
                      const downloadUrl = `${proxyUrl}?download=1`;
                      return (
                        <figure key={g.id} className="space-y-2">
                          <a
                            href={downloadUrl}
                            download
                            className="relative block aspect-[4/5] overflow-hidden border border-[var(--color-line)] bg-[var(--color-paper-2)] group"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={proxyUrl}
                              alt={sceneName}
                              className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
                            />
                            {g.watermarked ? (
                              <span className="absolute top-2 left-2 font-mono text-[9px] tracking-[0.18em] uppercase bg-black/70 text-white px-2 py-0.5">
                                Preview
                              </span>
                            ) : null}
                            <span className="absolute bottom-2 right-2 font-mono text-[9px] tracking-[0.18em] uppercase bg-[var(--color-paper)]/90 text-[var(--color-ink)] px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              Download ↓
                            </span>
                          </a>
                          <figcaption className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--color-ink-3)]">
                            {sceneName}
                          </figcaption>
                        </figure>
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
