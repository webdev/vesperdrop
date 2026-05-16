"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { track } from "@/lib/analytics";
import { CompleteLookButton } from "@/components/app/complete-look-button";
import { DeleteBatchDialog } from "@/components/app/delete-batch-dialog";
import { EditableRunTitle } from "@/components/app/editable-run-title";
import { HeroGenerationCard } from "@/components/app/hero-generation-card";
import { PackGallery } from "@/components/app/pack-gallery";
import { UpgradeRequiredDialog } from "@/components/app/upgrade-required-dialog";
import {
  downloadImage,
  DownloadUpgradeRequiredError,
} from "@/lib/download-image";
import { useFaceBoxEnabled } from "@/components/dev/face-box-toggle";
import { FaceSafeImage } from "@/components/ui/face-safe-image";
import { PageShell } from "@/components/ui/page-shell";
import { Pill } from "@/components/ui/pill";
import { Lightbox } from "./lightbox";

export type FocalPoint = {
  x: number;
  y: number;
  confidence: number;
  source: "face" | "saliency" | "center";
};

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

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
  createdAt?: string | null;
  completedAt?: string | null;
  focalPoint?: FocalPoint | null;
  faceBox?: FaceBox | null;
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
  name: string | null;
};

interface Props {
  runId: string;
  run: RunInfo;
  scenes: SceneInfo[];
  initial: Generation[];
  initialPacks: Pack[];
  /** Plan-driven watermark + lock policy. When false (paid), watermark
      labels and complete-look paywall popovers don't show. */
  isFreePlan: boolean;
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

export function RunGrid({
  runId,
  run,
  scenes,
  initial,
  initialPacks,
  isFreePlan,
}: Props) {
  const [gens, setGens] = useState<Generation[]>(initial);
  const [packs, setPacks] = useState<Pack[]>(initialPacks);
  const [activeScene, setActiveScene] = useState<string>("all");
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const completedTracked = useRef(false);
  const perGenTracked = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const g of gens) {
      if (g.status !== "succeeded" && g.status !== "failed") continue;
      if (perGenTracked.current.has(g.id)) continue;
      perGenTracked.current.add(g.id);
      if (g.status === "succeeded") {
        const created = g.createdAt ? Date.parse(g.createdAt) : NaN;
        const done = g.completedAt ? Date.parse(g.completedAt) : NaN;
        const duration =
          Number.isFinite(created) && Number.isFinite(done) ? done - created : null;
        track("image_generated", {
          run_id: runId,
          generation_id: g.id,
          preset_id: g.presetId,
          quality: g.quality,
          watermarked: g.watermarked,
          duration_ms: duration,
        });
      } else {
        track("image_failed", {
          run_id: runId,
          generation_id: g.id,
          preset_id: g.presetId,
          error: g.error ?? "unknown",
        });
      }
    }

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
  const allSucceeded = useMemo(
    () => gens.filter((g) => g.status === "succeeded" && g.outputUrl),
    [gens],
  );
  // Effective watermarking is plan-driven: a row's `watermarked` flag
  // only matters when the user is currently on free.
  const allWatermarked =
    isFreePlan &&
    succeededTopLevel.length > 0 &&
    succeededTopLevel.every((g) => g.watermarked);

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
  const inProgress = topLevel.some(
    (g) => g.status === "pending" || g.status === "running",
  );
  const metaLabel = allWatermarked
    ? `${totalSucceeded} ${totalSucceeded === 1 ? "preview" : "previews"} · watermarked`
    : `${totalSucceeded} ${totalSucceeded === 1 ? "image" : "images"}`;

  const visibleGroups =
    activeScene === "all"
      ? groups
      : groups.filter((g) => g.slug === activeScene);

  // Lightbox can open from either top-level tiles OR pack shots, so search
  // the full generation list rather than just topLevel.
  const lightboxGen = lightboxId
    ? gens.find((g) => g.id === lightboxId) ?? null
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

  async function downloadAll(items: Generation[]) {
    for (const g of items) {
      if (!(g.status === "succeeded" && g.outputUrl)) continue;
      try {
        await downloadImage(g.id);
      } catch (e) {
        if (e instanceof DownloadUpgradeRequiredError) {
          setUpgradeOpen(true);
          return;
        }
        throw e;
      }
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
        <aside className="flex flex-col gap-8 md:w-[260px] md:shrink-0 md:self-start lg:sticky lg:top-24">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
              {dateShort}
            </p>
            <EditableRunTitle
              runId={runId}
              customName={run.name}
              fallback={batchTitle}
              as="h1"
              className="mt-3 font-serif text-[clamp(2rem,3vw,2.5rem)] leading-[1.05] tracking-[-0.01em] text-ink"
            />
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
                onClick={() => downloadAll(allSucceeded)}
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
              <div className="relative aspect-[4/5] w-[108px] overflow-hidden rounded-md border border-line-soft/70 bg-paper-2 opacity-95">
                <Image
                  src={sourceUrl}
                  alt="Source product photo"
                  fill
                  sizes="108px"
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

          <div className="border-t border-line-soft pt-6">
            <DeleteBatchDialog
              runId={runId}
              label={run.name ?? batchTitle}
              redirectTo="/app/library"
            >
              <button
                type="button"
                className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-terracotta-dark"
              >
                <span aria-hidden>×</span> Delete batch
              </button>
            </DeleteBatchDialog>
          </div>
        </aside>

        {/* Right gallery */}
        <div className="flex min-w-0 flex-1 flex-col gap-12">
          {inProgress ? (
            <HeroGenerationCard generations={gens} scenes={scenes} />
          ) : (
            <>
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
                    No generated images yet
                  </p>
                  <p className="mt-3 font-serif text-2xl text-ink">
                    This batch is empty.
                  </p>
                </div>
              ) : (
                visibleGroups.map((group, i) => (
                  <Fragment key={group.slug}>
                    {i > 0 ? (
                      <div
                        aria-hidden
                        className="h-px w-full"
                        style={{ background: "rgba(0,0,0,0.08)" }}
                      />
                    ) : null}
                    <SceneSection
                      runId={runId}
                      name={group.name}
                      items={group.items}
                      isFreePlan={isFreePlan}
                      onTileClick={openLightbox}
                      onPackCreated={handlePackCreated}
                    />
                  </Fragment>
                ))
              )}
            </>
          )}

          {packs.map((p) => (
            <PackGallery
              key={p.id}
              runId={runId}
              pack={p}
              initialShots={shotsByPack.get(p.id) ?? []}
              onTileClick={openLightbox}
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
          onUpgradeRequired={() => setUpgradeOpen(true)}
        />
      ) : null}

      <UpgradeRequiredDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
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
  isFreePlan,
  onTileClick,
  onPackCreated,
}: {
  runId: string;
  name: string;
  items: Generation[];
  isFreePlan: boolean;
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
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {items.map((g) => (
          <Tile
            key={g.id}
            runId={runId}
            generation={g}
            isFreePlan={isFreePlan}
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
  isFreePlan,
  onPackCreated,
  onClick,
}: {
  runId: string;
  generation: Generation;
  isFreePlan: boolean;
  onPackCreated: (pack: Pack, shots: Generation[]) => void;
  onClick: () => void;
}) {
  const succeeded = g.status === "succeeded" && g.outputUrl;
  const showFaceBox = useFaceBoxEnabled();
  // Effective watermarked: row's watermarked flag only matters if user
  // is currently on free. Drives the Preview gradient + the locked
  // paywall on the Complete-the-look popover.
  const effectivelyWatermarked = g.watermarked && isFreePlan;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Image card — image only, no CTA overlay. Image is fully visible. */}
      <div className="group relative aspect-[4/5] overflow-hidden rounded-md border border-line-soft bg-paper-2 transition-shadow duration-200 ease-out hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        {succeeded ? (
          <>
            <button
              type="button"
              onClick={onClick}
              aria-label="View full size"
              className="absolute inset-0 z-0 cursor-zoom-in"
            >
              {showFaceBox ? (
                <Image
                  src={`/api/images/${g.id}`}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  unoptimized
                  className="object-contain transition-transform duration-200 ease-out group-hover:scale-[1.02]"
                />
              ) : (
                <FaceSafeImage
                  src={`/api/images/${g.id}`}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  unoptimized
                  className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
                  faceBox={g.faceBox}
                  focalPoint={g.focalPoint}
                />
              )}
            </button>
            {showFaceBox ? (
              <FaceBoxOverlay faceBox={g.faceBox} focalPoint={g.focalPoint} />
            ) : null}
            {effectivelyWatermarked ? (
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
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
              {g.status === "running" ? "Generating" : "Queued"}
            </span>
          </div>
        )}
      </div>

      {/* CTA block — sits below the image so the photo stays fully
          visible. Only renders for succeeded gens. Mini pack previews
          underneath communicate value before click; each preview opens
          the same popover the main CTA opens via a shared trigger ref. */}
      {succeeded ? (
        <CtaBlock
          runId={runId}
          parentGenerationId={g.id}
          disabled={!g.sceneifyGenerationId}
          locked={effectivelyWatermarked}
          onPackCreated={onPackCreated}
        />
      ) : null}
    </div>
  );
}

function CtaBlock({
  runId,
  parentGenerationId,
  disabled,
  locked,
  onPackCreated,
}: {
  runId: string;
  parentGenerationId: string;
  disabled: boolean;
  locked: boolean;
  onPackCreated: (pack: Pack, shots: Generation[]) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="group/cta flex flex-col items-stretch text-center">
      <CompleteLookButton
        runId={runId}
        parentGenerationId={parentGenerationId}
        disabled={disabled}
        locked={locked}
        onPackCreated={onPackCreated}
        triggerRef={triggerRef}
        triggerClassName="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-cream transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        triggerLabel={
          <>
            Generate full set <span aria-hidden>→</span>
          </>
        }
      />
      <p className="mt-1.5 text-[12px] leading-[1.4] text-ink-3 opacity-70 transition-opacity duration-200 group-hover/cta:opacity-100">
        Ready for Amazon, Shopify, and social
      </p>
    </div>
  );
}

// Debug overlay. Coordinates from Sceneify are normalized 0–1 against the
// image's natural dimensions. Caller switches the underlying <Image> to
// object-contain when the overlay is on, so we render letterbox-aware: we
// project the box into the image's actual displayed rect inside the
// container (letterboxed top/bottom or pillarboxed left/right).
function FaceBoxOverlay({
  faceBox,
  focalPoint,
}: {
  faceBox?: FaceBox | null;
  focalPoint?: FocalPoint | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    null,
  );

  useEffect(() => {
    if (!natural) return;
    const el = containerRef.current;
    if (!el) return;
    function compute() {
      const c = el!.getBoundingClientRect();
      const containerAspect = c.width / c.height;
      const naturalAspect = natural!.w / natural!.h;
      let width: number, height: number, left: number, top: number;
      if (naturalAspect > containerAspect) {
        // letterbox top/bottom
        width = c.width;
        height = c.width / naturalAspect;
        left = 0;
        top = (c.height - height) / 2;
      } else {
        // pillarbox left/right
        height = c.height;
        width = c.height * naturalAspect;
        top = 0;
        left = (c.width - width) / 2;
      }
      setRect({ left, top, width, height });
    }
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [natural]);

  // Sniff the natural dimensions from any <img> the parent rendered. We don't
  // own the image element, so we listen on the parent for image loads.
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    function onLoad(e: Event) {
      const img = e.target as HTMLImageElement | null;
      if (!img || img.tagName !== "IMG") return;
      if (img.naturalWidth && img.naturalHeight) {
        setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      }
    }
    el.addEventListener("load", onLoad, true);
    // Already-loaded images don't fire load again — pull from the first <img>.
    const existing = el.querySelector("img") as HTMLImageElement | null;
    if (existing?.complete && existing.naturalWidth) {
      setNatural({ w: existing.naturalWidth, h: existing.naturalHeight });
    }
    return () => el.removeEventListener("load", onLoad, true);
  }, []);

  if (!faceBox && !focalPoint) return null;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-10">
      {rect && faceBox ? (
        <div
          className="absolute border-2 border-terracotta shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{
            left: `${rect.left + faceBox.x * rect.width}px`,
            top: `${rect.top + faceBox.y * rect.height}px`,
            width: `${faceBox.width * rect.width}px`,
            height: `${faceBox.height * rect.height}px`,
          }}
        >
          <span className="absolute -top-5 left-0 rounded bg-terracotta px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-cream">
            face {Math.round(faceBox.confidence * 100)}%
          </span>
        </div>
      ) : null}
      {rect && focalPoint ? (
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cream bg-terracotta shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{
            left: `${rect.left + focalPoint.x * rect.width}px`,
            top: `${rect.top + focalPoint.y * rect.height}px`,
          }}
          title={`focal · ${focalPoint.source} · ${Math.round(focalPoint.confidence * 100)}%`}
        />
      ) : null}
    </div>
  );
}
