"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { track } from "@/lib/analytics";
import { CompleteLookButton } from "@/components/app/complete-look-button";
import { PackGallery } from "@/components/app/pack-gallery";
import { PageShell } from "@/components/ui/page-shell";
import { Pill } from "@/components/ui/pill";
import { Lightbox } from "./lightbox";

export type Generation = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  outputUrl: string | null;
  presetId: string;
  error: string | null;
  watermarked: boolean;
  quality: "preview" | "hd";
  sceneifySourceId: string | null;
  sceneifyGenerationId: string | null;
  parentGenerationId: string | null;
  packId: string | null;
  packRole: string | null;
  packShotIndex: number | null;
};

export type Pack = {
  id: string;
  parentGenerationId: string;
  platform: "amazon" | "shopify" | "instagram" | "tiktok";
  shotCount: number;
  status: "pending" | "running" | "succeeded" | "partial" | "failed";
};

export type SceneInfo = { slug: string; name: string };

type RunInfo = {
  id: string;
  createdAt: string;
  totalImages: number;
  presetCount: number;
};

interface Props {
  runId: string;
  run: RunInfo;
  scenes: SceneInfo[];
  initial: Generation[];
  initialPacks: Pack[];
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function deriveTitle(names: string[]): string {
  if (names.length === 0) return "Untitled batch";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]} + ${names.length - 1} more`;
}

export function RunGrid({ runId, run, scenes, initial, initialPacks }: Props) {
  const [gens, setGens] = useState<Generation[]>(initial);
  const [packs, setPacks] = useState<Pack[]>(initialPacks);
  const [activeScene, setActiveScene] = useState<string>("all");
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const completedTracked = useRef(false);

  useEffect(() => {
    const allDone = gens.every(
      (g) => g.status === "succeeded" || g.status === "failed",
    );
    if (allDone && !completedTracked.current) {
      completedTracked.current = true;
      const succeeded = gens.filter((g) => g.status === "succeeded").length;
      const failed = gens.filter((g) => g.status === "failed").length;
      track("run_complete", {
        run_id: runId,
        succeeded,
        failed,
        total: gens.length,
      });
    }
    if (allDone) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) return;
      const { generations, packs: nextPacks } = await res.json();
      if (Array.isArray(generations)) setGens(generations);
      if (Array.isArray(nextPacks)) setPacks(nextPacks);
    }, 2500);
    return () => clearInterval(t);
  }, [runId, gens]);

  const sceneNameBySlug = useMemo(
    () => new Map(scenes.map((s) => [s.slug, s.name])),
    [scenes],
  );
  const topLevel = useMemo(() => gens.filter((g) => !g.packId), [gens]);
  const succeededTopLevel = useMemo(
    () => topLevel.filter((g) => g.status === "succeeded" && g.outputUrl),
    [topLevel],
  );
  const allWatermarked =
    succeededTopLevel.length > 0 && succeededTopLevel.every((g) => g.watermarked);

  const groups = useMemo(() => {
    const m = new Map<string, Generation[]>();
    for (const g of topLevel) {
      const arr = m.get(g.presetId) ?? [];
      arr.push(g);
      m.set(g.presetId, arr);
    }
    return Array.from(m.entries()).map(([slug, items]) => ({
      slug,
      name: sceneNameBySlug.get(slug) ?? slug,
      items,
      succeeded: items.filter((g) => g.status === "succeeded" && g.outputUrl),
    }));
  }, [topLevel, sceneNameBySlug]);

  const sceneNamesPresent = useMemo(
    () =>
      Array.from(
        new Set(
          succeededTopLevel
            .map((g) => sceneNameBySlug.get(g.presetId))
            .filter((v): v is string => Boolean(v)),
        ),
      ),
    [succeededTopLevel, sceneNameBySlug],
  );

  const batchTitle = deriveTitle(sceneNamesPresent);
  const createdAt = new Date(run.createdAt);
  const dateShort = DATE_FMT.format(createdAt).toUpperCase();
  const dateLong = DATETIME_FMT.format(createdAt);

  const sourceCarrier = topLevel.find(
    (g) =>
      g.sceneifySourceId &&
      (g.sceneifySourceId.startsWith("__local__/") ||
        /^https?:\/\//i.test(g.sceneifySourceId)),
  );
  const sourceUrl = sourceCarrier
    ? `/api/images/${sourceCarrier.id}?type=source`
    : null;

  const totalSucceeded = succeededTopLevel.length;
  const metaLabel = allWatermarked
    ? `${totalSucceeded} ${totalSucceeded === 1 ? "preview" : "previews"} · watermarked`
    : `${totalSucceeded} ${totalSucceeded === 1 ? "image" : "images"}`;

  const visibleGroups =
    activeScene === "all"
      ? groups
      : groups.filter((g) => g.slug === activeScene);

  const lightboxGen = lightboxId
    ? topLevel.find((g) => g.id === lightboxId) ?? null
    : null;

  const shotsByPack = useMemo(() => {
    const map = new Map<string, Generation[]>();
    for (const g of gens) {
      if (!g.packId) continue;
      const arr = map.get(g.packId) ?? [];
      arr.push(g);
      map.set(g.packId, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.packShotIndex ?? 0) - (b.packShotIndex ?? 0));
    }
    return map;
  }, [gens]);

  function handlePackCreated(p: Pack, shots: Generation[]) {
    setPacks((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev;
      return [...prev, p];
    });
    setGens((prev) => {
      const existing = new Set(prev.map((g) => g.id));
      const additions = shots.filter((s) => !existing.has(s.id));
      return additions.length === 0 ? prev : [...prev, ...additions];
    });
  }

  function downloadAll(items: Generation[]) {
    for (const g of items) {
      if (!(g.status === "succeeded" && g.outputUrl)) continue;
      const a = document.createElement("a");
      a.href = `/api/images/${g.id}?download=1`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  const openLightbox = (id: string) => setLightboxId(id);

  return (
    <PageShell rhythm="loose">
      <div>
        <Link
          href="/app/library"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> Back to library
        </Link>
      </div>

      <div className="flex flex-col gap-10 md:flex-row md:gap-12 lg:gap-16">
        {/* Left rail */}
        <aside className="flex flex-col gap-8 md:w-[280px] md:shrink-0 md:self-start lg:sticky lg:top-24">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
              {dateShort}
            </p>
            <h1 className="mt-3 font-serif text-[clamp(2rem,3vw,2.5rem)] leading-[1.05] tracking-[-0.01em] text-ink">
              {batchTitle}
            </h1>
            {allWatermarked ? (
              <div className="mt-4">
                <Pill tone="accent" className="tracking-[0.12em]">
                  Preview
                </Pill>
              </div>
            ) : totalSucceeded > 0 ? (
              <div className="mt-4">
                <Pill tone="neutral" className="tracking-[0.12em]">
                  HD
                </Pill>
              </div>
            ) : null}
            <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-4">
              {metaLabel}
            </p>
          </div>

          {totalSucceeded > 0 ? (
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => downloadAll(succeededTopLevel)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
              >
                <span aria-hidden>↓</span> Download all
              </button>
              <Link
                href="/try"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-paper-soft px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
              >
                Use this style again
              </Link>
            </div>
          ) : null}

          {sourceUrl ? (
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
                Source photo
              </p>
              <div className="relative aspect-[4/5] w-40 overflow-hidden rounded-md border border-line-soft bg-paper-2">
                <Image
                  src={sourceUrl}
                  alt="Source product photo"
                  fill
                  sizes="160px"
                  unoptimized
                  className="object-cover"
                />
              </div>
            </div>
          ) : null}

          <dl className="space-y-3 border-t border-line-soft pt-6 text-[13px]">
            <DefRow term="Scenes" value={String(run.presetCount)} />
            <DefRow term="Total" value={String(run.totalImages)} />
            <DefRow term="Created" value={dateLong} />
          </dl>
        </aside>

        {/* Right gallery */}
        <div className="flex min-w-0 flex-1 flex-col gap-12">
          {groups.length > 1 ? (
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line-soft pb-3">
              <FilterTab
                active={activeScene === "all"}
                onClick={() => setActiveScene("all")}
              >
                All
              </FilterTab>
              {groups.map((g) => (
                <FilterTab
                  key={g.slug}
                  active={activeScene === g.slug}
                  onClick={() => setActiveScene(g.slug)}
                >
                  {g.name}
                </FilterTab>
              ))}
            </nav>
          ) : null}

          {visibleGroups.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface p-12 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                Working on it
              </p>
              <p className="mt-3 font-serif text-2xl text-ink">
                Your batch is still developing.
              </p>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-[1.55] text-ink-3">
                Tiles appear as each scene finishes — usually within ninety
                seconds.
              </p>
            </div>
          ) : (
            visibleGroups.map((group) => (
              <SceneSection
                key={group.slug}
                runId={runId}
                name={group.name}
                items={group.items}
                onDownloadAll={() => downloadAll(group.succeeded)}
                onTileClick={openLightbox}
                onPackCreated={handlePackCreated}
              />
            ))
          )}

          {packs.map((p) => (
            <PackGallery
              key={p.id}
              runId={runId}
              pack={p}
              initialShots={shotsByPack.get(p.id) ?? []}
              onPackUpdate={(updated) =>
                setPacks((prev) =>
                  prev.map((x) => (x.id === updated.id ? updated : x)),
                )
              }
              onShotsUpdate={(updatedShots) => {
                setGens((prev) => {
                  const byId = new Map(prev.map((g) => [g.id, g]));
                  for (const s of updatedShots) byId.set(s.id, s);
                  return Array.from(byId.values());
                });
              }}
            />
          ))}
        </div>
      </div>

      {lightboxGen && lightboxGen.outputUrl ? (
        <Lightbox
          generationId={lightboxGen.id}
          imageUrl={`/api/images/${lightboxGen.id}`}
          sceneName={sceneNameBySlug.get(lightboxGen.presetId) ?? lightboxGen.presetId}
          watermarked={lightboxGen.watermarked}
          sourceUrl={sourceUrl}
          dateLabel={dateShort}
          onClose={() => setLightboxId(null)}
        />
      ) : null}
    </PageShell>
  );
}

function DefRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
        {term}
      </dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-3 pb-3 text-[14px] transition-colors ${
        active
          ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-terracotta"
          : "text-ink-3 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SceneSection({
  runId,
  name,
  items,
  onDownloadAll,
  onTileClick,
  onPackCreated,
}: {
  runId: string;
  name: string;
  items: Generation[];
  onDownloadAll: () => void;
  onTileClick: (id: string) => void;
  onPackCreated: (pack: Pack, shots: Generation[]) => void;
}) {
  const succeededCount = items.filter(
    (g) => g.status === "succeeded" && g.outputUrl,
  ).length;

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-4 border-b border-line-soft pb-3">
        <div className="flex items-baseline gap-3">
          <h3 className="font-mono text-[12px] uppercase tracking-[0.12em] text-ink">
            {name}
          </h3>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-4">
            · {succeededCount} {succeededCount === 1 ? "image" : "images"}
          </span>
        </div>
        {succeededCount > 0 ? (
          <button
            type="button"
            onClick={onDownloadAll}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink"
          >
            <span aria-hidden>↓</span> Download all
          </button>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {items.map((g) => (
          <Tile
            key={g.id}
            runId={runId}
            generation={g}
            onPackCreated={onPackCreated}
            onClick={() => onTileClick(g.id)}
          />
        ))}
      </div>
    </section>
  );
}

function Tile({
  runId,
  generation: g,
  onPackCreated,
  onClick,
}: {
  runId: string;
  generation: Generation;
  onPackCreated: (pack: Pack, shots: Generation[]) => void;
  onClick: () => void;
}) {
  const succeeded = g.status === "succeeded" && g.outputUrl;

  return (
    <div className="group relative aspect-[4/5] overflow-hidden rounded-md border border-line-soft bg-paper-2">
      {succeeded ? (
        <>
          <button
            type="button"
            onClick={onClick}
            aria-label="View full size"
            className="absolute inset-0 z-0 cursor-zoom-in"
          >
            <Image
              src={`/api/images/${g.id}`}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          >
            <CompleteLookButton
              runId={runId}
              parentGenerationId={g.id}
              disabled={!g.sceneifyGenerationId}
              locked={g.watermarked}
              onPackCreated={onPackCreated}
            />
          </div>
          {g.watermarked ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 bg-gradient-to-t from-ink/70 to-transparent px-3 pb-3 pt-8">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-cream/85">
                Preview
              </span>
            </div>
          ) : null}
        </>
      ) : g.status === "failed" ? (
        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta">
            Failed
          </span>
          <span className="mt-2 text-[12px] leading-[1.4] text-ink-3">
            {g.error ?? "Generation failed"}
          </span>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <div className="h-5 w-5 rounded-full border-2 border-ink-4 border-t-transparent animate-spin" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4 capitalize">
            {g.status}
          </span>
        </div>
      )}
    </div>
  );
}
