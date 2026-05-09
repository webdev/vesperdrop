"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SceneifyPublicPreset } from "@/lib/sceneify/types";

type Uploaded = { url: string; name: string; mimeType: string };

const STEPS = ["Upload Images", "Choose Preset", "Generate"] as const;

const INITIAL_PRESET_COUNT = 6;

export function CreatePreviewWorkflow({
  presets,
}: {
  presets: SceneifyPublicPreset[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState<Uploaded[]>([]);
  const sortedPresets = useMemo(
    () => [...presets].sort((a, b) => a.displayOrder - b.displayOrder),
    [presets],
  );
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(
    sortedPresets[0]?.slug ? [sortedPresets[0].slug] : [],
  );
  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  function togglePreset(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }
  const [showAllPresets, setShowAllPresets] = useState(false);
  const visiblePresets = showAllPresets
    ? sortedPresets
    : sortedPresets.slice(0, INITIAL_PRESET_COUNT);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    url: string;
    expectedOutputCount: number;
  } | null>(null);

  const sourceCount = uploaded.length;
  const plan = useMemo(() => {
    if (sourceCount <= 2) {
      return {
        totalCount: 3,
        description: "3 random presets",
        sub: "(2 per image if > 2 images)",
      };
    }
    return {
      totalCount: sourceCount * 2,
      description: "2 per image",
      sub: "(2 outputs per reference image)",
    };
  }, [sourceCount]);

  const activeStep = useMemo(() => {
    if (sourceCount === 0) return 1;
    if (selectedSlugs.length === 0) return 2;
    return 3;
  }, [sourceCount, selectedSlugs.length]);

  const selectedNames = useMemo(
    () =>
      sortedPresets
        .filter((p) => selectedSet.has(p.slug))
        .map((p) => p.name),
    [sortedPresets, selectedSet],
  );
  const presetSummary =
    selectedNames.length === 0
      ? "—"
      : selectedNames.length === 1
        ? selectedNames[0]
        : `${selectedNames.length} selected`;

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of list) fd.append("files", f);
      const res = await fetch("/api/admin/previews/upload", {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "upload failed");
      setUploaded((prev) => [...prev, ...(data.files as Uploaded[])]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  function removeImage(url: string) {
    setUploaded((prev) => prev.filter((u) => u.url !== url));
  }

  async function generate() {
    if (uploaded.length === 0 || selectedSlugs.length === 0) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/previews/create", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceImages: uploaded,
          presetSlugs: selectedSlugs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "generate failed");
      setResult({
        url: data.url as string,
        expectedOutputCount: data.expectedOutputCount as number,
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    setUploaded([]);
    setSelectedSlugs(sortedPresets[0]?.slug ? [sortedPresets[0].slug] : []);
    setShowAllPresets(false);
    setResult(null);
    setError(null);
  }

  return (
    <section className="rounded-2xl border border-line-soft bg-surface/60 p-5 md:p-6">
      <StepStrip activeStep={activeStep} />

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Column>
          <ColumnTitle
            title="Upload reference images"
            subtitle="Add 1 or more images of the product."
          />
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-paper/60 px-4 py-8 text-center transition-colors",
              "hover:border-ink-4 hover:bg-paper",
              uploading && "opacity-60",
            )}
          >
            <CloudIcon />
            <p className="text-[14px] text-ink">Drop images here</p>
            <p className="text-[12px] text-ink-3">or click to browse</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
              JPG, PNG up to 10MB each
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  void handleFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
          </div>

          {uploaded.length > 0 && (
            <>
              <ul className="grid grid-cols-3 gap-2">
                {uploaded.map((u) => (
                  <li key={u.url} className="group/img relative aspect-square">
                    <Image
                      src={u.url}
                      alt={u.name}
                      fill
                      sizes="120px"
                      className="rounded-lg object-cover"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(u.url)}
                      aria-label={`Remove ${u.name}`}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/85 text-[10px] text-cream opacity-0 transition-opacity group-hover/img:opacity-100"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                {uploaded.length} image{uploaded.length === 1 ? "" : "s"} uploaded
              </p>
            </>
          )}

          <button
            type="button"
            disabled={uploaded.length === 0 || uploading}
            onClick={() => {
              const el = document.getElementById("ig-preset-list");
              el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }}
            className="rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-cream hover:bg-ink-2 disabled:opacity-40"
          >
            {uploading ? "Uploading…" : "Continue"}
          </button>

          <HelperCard
            title="How it works"
            bullets={[
              "We'll generate 3 random presets for 1–2 images.",
              "If you upload more than 2 images, we'll generate 2 images per reference image.",
            ]}
          />
        </Column>

        <Column>
          <ColumnTitle
            title="Choose from existing presets"
            subtitle="Select from our proven styles."
          />
          <ul id="ig-preset-list" className="flex flex-col gap-2">
            {visiblePresets.map((p) => {
              const selected = selectedSet.has(p.slug);
              return (
                <li key={p.slug}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                      selected
                        ? "border-ink bg-paper shadow-[var(--shadow-subtle)]"
                        : "border-line-soft bg-paper/60 hover:bg-paper",
                    )}
                  >
                    <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-line-soft bg-cream">
                      {p.heroImageUrl ? (
                        <Image
                          src={p.heroImageUrl}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                        <span className="truncate">{p.name}</span>
                        {p.isPro ? (
                          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-terracotta">
                            Pro
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-[11.5px] text-ink-3">
                        {p.description}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => togglePreset(p.slug)}
                      className="h-4 w-4 accent-ink"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          {sortedPresets.length > INITIAL_PRESET_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllPresets((v) => !v)}
              className="self-start text-[12px] text-ink-3 hover:text-ink"
            >
              {showAllPresets
                ? "Show fewer presets"
                : `Load more presets (${sortedPresets.length - INITIAL_PRESET_COUNT})`}
            </button>
          )}
        </Column>

        <Column>
          <ColumnTitle
            title="Review and generate"
            subtitle="Confirm your settings and generate."
          />
          <dl className="flex flex-col gap-0 rounded-xl border border-line-soft bg-paper/60">
            <KV label="Images uploaded" value={`${sourceCount} image${sourceCount === 1 ? "" : "s"}`} />
            <KV
              label={selectedNames.length > 1 ? "Presets selected" : "Preset selected"}
              value={presetSummary}
              sub={
                selectedNames.length > 1
                  ? selectedNames.join(", ")
                  : undefined
              }
            />
            <KV
              label="Generation logic"
              value={plan.description}
              sub={plan.sub}
            />
            <KV label="Estimated output" value={`${plan.totalCount} images`} last />
          </dl>

          <HelperCard
            title="What happens next?"
            tone="warm"
            icon={<SparkleIcon />}
            bullets={[
              "We generate the images in the background and pin them to a unique preview URL.",
              "You can copy the link to share immediately — generation finishes in roughly 30–60 seconds.",
            ]}
          />

          <button
            type="button"
            onClick={generate}
            disabled={
              sourceCount === 0 ||
              selectedSlugs.length === 0 ||
              generating ||
              !!result
            }
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-cream hover:bg-ink-2 disabled:opacity-40"
          >
            <SparkleIcon className="h-3.5 w-3.5" />
            {generating ? "Generating…" : "Generate Preview"}
          </button>
          {error && (
            <p className="text-[12px] text-rose-700">{error}</p>
          )}
          {result && (
            <div className="flex flex-col gap-3 rounded-xl border border-line-soft bg-paper p-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  Preview URL
                </p>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all text-[12.5px] text-ink underline-offset-2 hover:underline"
                >
                  {result.url}
                </a>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(result.url)}
                  className="flex-1 rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-cream hover:bg-ink-2"
                >
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-line bg-paper px-4 py-2 text-[12px] text-ink-2 hover:bg-surface"
                >
                  Start another
                </button>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                {result.expectedOutputCount} image
                {result.expectedOutputCount === 1 ? "" : "s"} queued
              </p>
            </div>
          )}
        </Column>
      </div>
    </section>
  );
}

function StepStrip({ activeStep }: { activeStep: number }) {
  return (
    <ol className="relative grid grid-cols-3 gap-3">
      <span
        aria-hidden
        className="absolute left-[16.67%] right-[16.67%] top-[14px] h-px bg-line"
      />
      {STEPS.map((label, i) => {
        const n = i + 1;
        const isActive = n === activeStep;
        const isDone = n < activeStep;
        return (
          <li key={label} className="relative flex flex-col items-center gap-2">
            <span
              className={cn(
                "z-10 grid h-7 w-7 place-items-center rounded-full border text-[12px] font-medium",
                isActive
                  ? "border-ink bg-ink text-cream"
                  : isDone
                    ? "border-ink bg-paper text-ink"
                    : "border-line bg-paper text-ink-3",
              )}
            >
              {n}
            </span>
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.14em]",
                isActive || isDone ? "text-ink" : "text-ink-3",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-paper p-4 md:p-5">
      {children}
    </div>
  );
}

function ColumnTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="font-serif text-[16px] leading-snug tracking-[-0.01em] text-ink">
        {title}
      </h3>
      <p className="mt-1 text-[12.5px] text-ink-3">{subtitle}</p>
    </div>
  );
}

function KV({
  label,
  value,
  sub,
  last,
}: {
  label: string;
  value: string;
  sub?: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 px-3 py-2.5",
        !last && "border-b border-line-soft",
      )}
    >
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </dt>
      <dd className="text-right text-[13px] text-ink">
        {value}
        {sub && <span className="ml-1 text-[11.5px] text-ink-4">{sub}</span>}
      </dd>
    </div>
  );
}

function HelperCard({
  title,
  bullets,
  tone = "neutral",
  icon,
}: {
  title: string;
  bullets: string[];
  tone?: "neutral" | "warm";
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "warm"
          ? "border-terracotta-soft/70 bg-[var(--terracotta-wash)]/60"
          : "border-line-soft bg-cream/60",
      )}
    >
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">
        {icon}
        {title}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 text-[12px] text-ink-3">
        {bullets.map((b) => (
          <li key={b} className="leading-snug">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-ink-3" fill="none">
      <path
        d="M7 18a4 4 0 1 1 .6-7.95A6 6 0 0 1 19 12a3.5 3.5 0 0 1 0 7H7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 14v-5m0 0-2 2m2-2 2 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-3.5 w-3.5", className)}
      fill="currentColor"
    >
      <path d="M12 2 13.6 8.4 20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2ZM18 14l.7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z" />
    </svg>
  );
}

