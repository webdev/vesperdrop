"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import type { Scene } from "@/lib/db/scenes";
import { PageShell } from "@/components/ui/page-shell";

type Props = {
  scenes: Scene[];
  initialSceneIds?: string[];
  credits: number;
};

type StepState = "active" | "done" | "pending";

export function RunForm({ scenes, initialSceneIds = [], credits }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [sceneIds, setSceneIds] = useState<string[]>(initialSceneIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  // Object URLs for thumbnails: derive from files; revoke when they change or
  // on unmount so we don't leak Blob handles.
  const fileUrls = useMemo(
    () => files.map((f) => URL.createObjectURL(f)),
    [files],
  );
  useEffect(() => {
    return () => {
      for (const u of fileUrls) URL.revokeObjectURL(u);
    };
  }, [fileUrls]);

  const total = files.length * sceneIds.length;
  const stepState = (n: 1 | 2 | 3): StepState => {
    if (n === 1) return files.length > 0 ? "done" : "active";
    if (n === 2) {
      if (files.length === 0) return "pending";
      return sceneIds.length > 0 ? "done" : "active";
    }
    if (files.length === 0 || sceneIds.length === 0) return "pending";
    return "active";
  };

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) return;
    setFiles((prev) => [...prev, ...incoming]);
  }
  function clearFiles() {
    setFiles([]);
  }
  function toggleScene(slug: string) {
    setSceneIds((prev) =>
      prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug],
    );
  }

  function submit() {
    setError(null);
    start(async () => {
      const form = new FormData();
      for (const f of files) form.append("files", f, f.name);
      for (const id of sceneIds) form.append("presetIds", id);
      const res = await fetch("/api/runs", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 402) {
          setError(
            "You're out of credits. Upgrade your plan or buy a credit pack.",
          );
        } else {
          setError(body.error ?? `HTTP ${res.status}`);
        }
        return;
      }
      const { runId } = await res.json();
      router.push(`/app/runs/${runId}`);
    });
  }

  const canSubmit = files.length > 0 && sceneIds.length > 0 && !pending;

  return (
    <PageShell rhythm="default">
      {/* Header */}
      <header>
        <Link
          href="/app/library"
          className="inline-flex items-center gap-1 text-[14px] text-ink-3 transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> Library
        </Link>
        <h1 className="mt-4 font-serif text-[3.25rem] font-medium leading-[1.1] tracking-[-0.02em] text-ink">
          Create new batch
        </h1>
        <p className="mt-2 max-w-xl text-[18px] leading-[1.4] text-ink-3">
          Upload your product photo and choose the looks you want to generate.
        </p>
      </header>

      {/* 2-column grid (220px stepper / flexible content) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr] lg:items-start">
        {/* Left stepper */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ol className="space-y-6">
            <StepItem
              n={1}
              title="Upload photo"
              description="Add a clear photo of your product."
              state={stepState(1)}
              hasConnector
            />
            <StepItem
              n={2}
              title="Choose scenes"
              description="Select one or more scenes."
              state={stepState(2)}
              hasConnector
            />
            <StepItem
              n={3}
              title="Generate"
              description="We'll create your images."
              state={stepState(3)}
            />
          </ol>
        </aside>

        {/* Center workflow — section gap 32px (var(--space-6)) */}
        <div className="space-y-8">
          {/* Step 1 — Upload */}
          <section
            className="rounded-lg border bg-surface p-6"
            style={{
              borderColor: "rgba(0,0,0,0.05)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.035)",
            }}
          >
            <header className="mb-5">
              <h2 className="font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.1] tracking-[-0.01em] text-ink">
                1. Upload product
              </h2>
              <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
                Use a clean, well-lit photo for the best results.
              </p>
            </header>

            {/* Horizontal flex: [upload box 260×260] [preview 260×160] [metadata] */}
            <div className="flex flex-col gap-5 md:flex-row md:items-start">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={`flex h-[260px] w-full shrink-0 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed transition-colors md:w-[260px] ${
                  dragOver
                    ? "border-terracotta bg-terracotta-wash/40"
                    : "border-line bg-paper-soft hover:border-ink-4"
                }`}
              >
                <UploadIcon />
                <p className="text-[14px] text-ink-2">
                  Drag and drop your image here
                </p>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
                  or
                </p>
                <span className="mt-3 inline-flex items-center rounded-full bg-ink px-5 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2">
                  Choose file
                </span>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
                  JPG or PNG · Max 25MB
                </p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />

              {files[0] ? (
                <>
                  {/* Preview 260×160 */}
                  <div className="h-[160px] w-full shrink-0 overflow-hidden rounded-md border border-line-soft bg-paper-2 md:w-[260px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrls[0]}
                      alt={files[0].name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {/* File metadata */}
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-ink">
                        {files[0].name}
                      </p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
                        {(files[0].size / 1024 / 1024).toFixed(1)} MB
                        {files.length > 1 ? ` · +${files.length - 1} more` : ""}
                      </p>
                      <button
                        type="button"
                        onClick={clearFiles}
                        className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink"
                      >
                        <span aria-hidden>↺</span> Replace
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={clearFiles}
                      aria-label="Remove uploaded file"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-4 transition-colors hover:bg-paper-2 hover:text-ink"
                    >
                      <span aria-hidden>×</span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </section>

          {/* Step 2 — Choose scenes */}
          <section
            className="rounded-lg border bg-surface p-6"
            style={{
              borderColor: "rgba(0,0,0,0.05)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.035)",
            }}
          >
            <header className="mb-5 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.1] tracking-[-0.01em] text-ink">
                  2. Choose your scenes
                </h2>
                <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
                  Select one or more scenes for your product.
                </p>
              </div>
              <p className="shrink-0 text-[14px] text-ink-3">
                {sceneIds.length} scene{sceneIds.length === 1 ? "" : "s"} selected
              </p>
            </header>

            {/* Selected strip — compact pills above the grid; clicking ×
                removes the scene. Hidden when nothing is selected. */}
            {sceneIds.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
                  Selected
                </span>
                {sceneIds.map((id) => {
                  const s = scenes.find((x) => x.slug === id);
                  if (!s) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleScene(id)}
                      aria-label={`Remove ${s.name}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-wash px-2.5 py-1 text-[11px] text-terracotta-dark transition-colors hover:bg-terracotta-wash/80"
                      style={{
                        border: "1px solid rgba(194,96,76,0.18)",
                      }}
                    >
                      {s.name}
                      <span
                        aria-hidden
                        className="text-[12px] leading-none opacity-70"
                      >
                        ×
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(140px, 1fr))",
              }}
            >
              {scenes.map((s) => {
                const sel = sceneIds.includes(s.slug);
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => toggleScene(s.slug)}
                    aria-pressed={sel}
                    className="group relative overflow-hidden rounded-md text-left transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      border: sel
                        ? "1px solid var(--color-terracotta, #c2604c)"
                        : "1px solid rgba(0,0,0,0.08)",
                      // Soft halo on selected; subtle drop on hover otherwise.
                      boxShadow: sel
                        ? "0 0 0 2px rgba(198,95,61,0.12), 0 6px 16px rgba(0,0,0,0.04)"
                        : "0 0 0 0 rgba(0,0,0,0)",
                    }}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-paper-2">
                      <SceneImage src={s.imageUrl} alt={s.name} />
                      {/* Warm bottom tint when selected — barely-there cue. */}
                      {sel ? (
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background:
                              "linear-gradient(to top, rgba(198,95,61,0.06), transparent)",
                          }}
                        />
                      ) : null}
                      {s.isPro ? (
                        <span
                          className="absolute left-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink/55 backdrop-blur-sm"
                          style={{ color: "#e4b961" }}
                          title="Pro scene"
                        >
                          <Crown aria-hidden className="h-3 w-3" fill="currentColor" />
                          <span className="sr-only">Pro scene</span>
                        </span>
                      ) : null}
                      {/* Selection check — 22px, fade+scale in via key. */}
                      {sel ? (
                        <span
                          key="check"
                          aria-hidden
                          className="absolute right-2.5 top-2.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-terracotta text-[10px] text-cream shadow-subtle motion-safe:animate-[check-in_180ms_ease-out]"
                        >
                          ✓
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className="absolute right-2.5 top-2.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-cream/70 bg-cream/25 backdrop-blur"
                        />
                      )}
                    </div>
                    {/* Min-height keeps title/mood block aligned across cards
                        regardless of name length or mood presence. */}
                    <div className="min-h-[72px] bg-surface px-3 py-3">
                      <p className="font-serif text-[15px] leading-[1.2] text-ink">
                        {s.name}
                      </p>
                      {s.mood ? (
                        <span
                          className="mt-2 inline-block max-w-full truncate rounded-full font-mono text-[11px] uppercase tracking-[0.04em]"
                          style={{
                            padding: "6px 10px",
                            background: "rgba(255,255,255,0.75)",
                            border: "1px solid rgba(0,0,0,0.05)",
                            color: "rgba(0,0,0,0.55)",
                          }}
                        >
                          {s.mood}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}

              {/* Locked card — Pro plan affordance */}
              <Link
                href="/pricing"
                className="group relative overflow-hidden rounded-md text-left transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  border: "1px dashed rgba(0,0,0,0.08)",
                  background: "var(--color-paper-soft, #f1ede5)",
                  boxShadow: "0 0 0 0 rgba(0,0,0,0)",
                }}
              >
                <div
                  className="relative flex aspect-[4/5] items-center justify-center text-ink-3"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-paper-2, #ebe6dc) 0%, var(--color-paper-soft, #f1ede5) 100%)",
                  }}
                >
                  <LockIcon />
                </div>
                <div className="min-h-[72px] bg-surface px-3 py-3">
                  <p className="font-serif text-[15px] leading-[1.2] text-ink-2">
                    Unlock more scenes
                  </p>
                  <span
                    className="mt-2 inline-block rounded-full font-mono text-[11px] uppercase tracking-[0.04em]"
                    style={{
                      padding: "6px 10px",
                      background: "rgba(255,255,255,0.75)",
                      border: "1px solid rgba(0,0,0,0.05)",
                      color: "rgba(0,0,0,0.55)",
                    }}
                  >
                    Available on Pro
                  </span>
                </div>
              </Link>
            </div>
          </section>

          {/* Error display (sits above the sticky bar in the content column) */}
          {error ? (
            <div className="rounded-md border border-terracotta/30 bg-terracotta-wash px-4 py-3 text-[14px] text-terracotta-dark">
              {error}
              {error.includes("credits") ? (
                <a
                  href="/pricing"
                  className="ml-2 underline underline-offset-4"
                >
                  View plans →
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Sticky bottom action bar. Upward shadow per spec so the bar
          reads as elevated above the page rather than floating flatly. */}
      <div
        className="sticky bottom-6 mx-auto w-full max-w-[980px] rounded-lg bg-surface p-5"
        style={{
          border: "1px solid rgba(0,0,0,0.05)",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between">
          <div className="md:flex-1">
            <p className="text-[14px] font-medium text-ink">
              You have {credits} {credits === 1 ? "credit" : "credits"}
            </p>
            <p className="mt-1 text-[13px] text-ink-3">
              Need more credits?{" "}
              <Link
                href="/pricing"
                className="text-terracotta transition-colors hover:text-terracotta-dark"
              >
                View plans →
              </Link>
            </p>
          </div>
          <p
            className="text-[14px] md:text-center"
            style={{
              color: canSubmit ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.5)",
            }}
          >
            {!canSubmit && sceneIds.length === 0
              ? files.length === 0
                ? "Upload a photo and select a scene to continue"
                : "Select at least one scene to continue"
              : files.length === 0
                ? "Upload a photo to continue"
                : (
                    <>
                      {sceneIds.length}{" "}
                      {sceneIds.length === 1 ? "scene" : "scenes"} selected ·
                      Est. credits:{" "}
                      <span className="text-ink">{total}</span>
                    </>
                  )}
          </p>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[14px] font-medium text-cream transition-all duration-200 hover:bg-ink-2 hover:shadow-[0_6px_18px_rgba(0,0,0,0.15)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none md:flex-none"
          >
            {pending ? "Starting…" : "Continue to review"}
          </button>
        </div>
      </div>
    </PageShell>
  );
}

function StepItem({
  n,
  title,
  description,
  state,
  hasConnector = false,
}: {
  n: number;
  title: string;
  description: string;
  state: StepState;
  hasConnector?: boolean;
}) {
  return (
    <li
      className="relative flex gap-4 transition-opacity duration-200"
      style={{ opacity: state === "pending" ? 0.55 : 1 }}
    >
      <div className="flex flex-col items-center">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[12px] ${
            state === "active"
              ? "bg-terracotta text-cream"
              : state === "done"
                ? "bg-terracotta-wash text-terracotta-dark"
                : "border border-line bg-paper-soft text-ink-4"
          }`}
        >
          {state === "done" ? <span aria-hidden>✓</span> : n}
        </div>
        {hasConnector ? (
          <span
            aria-hidden
            className="mt-2 h-10 w-px bg-line-soft"
          />
        ) : null}
      </div>
      <div className="flex-1 pt-0.5">
        <p
          className={`font-serif text-[15px] leading-[1.2] tracking-[-0.005em] ${
            state === "pending" ? "text-ink-3" : "text-ink"
          }`}
        >
          {title}
        </p>
        <p
          className={`mt-1 text-[12px] leading-[1.45] ${
            state === "pending" ? "text-ink-4" : "text-ink-3"
          }`}
        >
          {description}
        </p>
      </div>
    </li>
  );
}

function UploadIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-ink-3"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m21 15-4.5-4.5L9 18" />
    </svg>
  );
}

/**
 * Image with intentional skeleton fallback for loading + error states.
 * Avoids the broken-image icon and the bare beige rectangle that read
 * as "broken card" — instead shows a warm shimmer until the image
 * decodes, and stays in skeleton mode if the URL fails entirely.
 */
function SceneImage({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  return (
    <>
      {state !== "loaded" ? (
        <div
          aria-hidden
          className="absolute inset-0 motion-safe:animate-[scene-shimmer_1600ms_ease-in-out_infinite]"
          style={{
            background:
              "linear-gradient(110deg, var(--color-paper-2, #ebe6dc) 0%, var(--color-paper-soft, #f1ede5) 50%, var(--color-paper-2, #ebe6dc) 100%)",
            backgroundSize: "200% 100%",
          }}
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
        className="absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-[1.03]"
        style={{
          opacity: state === "loaded" ? 1 : 0,
        }}
      />
      <style jsx global>{`
        @keyframes scene-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -100% 0;
          }
        }
        @keyframes check-in {
          from {
            opacity: 0;
            transform: scale(0.7);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}

function LockIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
