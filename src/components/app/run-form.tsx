"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Scene } from "@/lib/db/scenes";

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

  const sceneById = useMemo(() => {
    const m = new Map<string, Scene>();
    for (const s of scenes) m.set(s.slug, s);
    return m;
  }, [scenes]);

  const selectedScenes = sceneIds
    .map((id) => sceneById.get(id))
    .filter((s): s is Scene => Boolean(s));

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
    <div className="w-full">
      {/* Hero header */}
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          Styles
        </p>
        <h1 className="mt-3 font-serif text-[clamp(2.75rem,5.5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-ink">
          New batch
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-[1.55] text-ink-3">
          Upload product photos, pick scenes, generate.
        </p>
      </header>

      {/* Discover callout */}
      <Link
        href="/discover"
        className="group mt-10 flex items-center justify-between gap-6 rounded-lg border border-line-soft bg-paper-soft px-5 py-4 transition-colors hover:border-line"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta">
            New
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
            · Style discovery
          </span>
          <span className="text-[14px] text-ink-2">
            Not sure which scenes? Train your eye on a quick swipe deck.
          </span>
        </div>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink">
          Try Discover <span aria-hidden>→</span>
        </span>
      </Link>

      {/* 3-column workflow */}
      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[200px_1fr_300px] lg:gap-8">
        {/* Left stepper */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ol className="space-y-7">
            <StepItem
              n={1}
              title="Upload product"
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

        {/* Center workflow */}
        <div className="space-y-10">
          {/* Step 1 — Upload */}
          <section className="rounded-xl border border-line-soft bg-surface p-6 md:p-8">
            <header className="mb-6">
              <h2 className="font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.1] tracking-[-0.01em] text-ink">
                1. Upload product
              </h2>
              <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
                Use a clean, well-lit photo for the best results.
              </p>
            </header>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_220px]">
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
                className={`flex h-[280px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed transition-colors ${
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
                <span className="inline-flex items-center rounded-full bg-ink px-5 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2">
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
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
                    Source photo
                  </p>
                  <div className="mt-3 aspect-[4/5] overflow-hidden rounded-md border border-line-soft bg-paper-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrls[0]}
                      alt={files[0].name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={clearFiles}
                    className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink"
                  >
                    <span aria-hidden>↺</span> Replace image
                  </button>
                  <p className="mt-3 truncate text-[13px] text-ink-2">
                    {files[0].name}
                  </p>
                  {files.length > 1 ? (
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
                      +{files.length - 1} more
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {/* Step 2 — Choose scenes */}
          <section className="rounded-xl border border-line-soft bg-surface p-6 md:p-8">
            <header className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.1] tracking-[-0.01em] text-ink">
                  2. Choose scenes
                </h2>
                <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
                  Select one or more scenes for your product.
                </p>
              </div>
              <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                {sceneIds.length} scene{sceneIds.length === 1 ? "" : "s"} selected
              </p>
            </header>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {scenes.map((s) => {
                const sel = sceneIds.includes(s.slug);
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => toggleScene(s.slug)}
                    aria-pressed={sel}
                    className={`group relative overflow-hidden rounded-md border text-left transition-colors ${
                      sel
                        ? "border-terracotta ring-2 ring-terracotta"
                        : "border-line-soft hover:border-line"
                    }`}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-paper-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.imageUrl}
                        alt={s.name}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                      <span
                        className={`absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] transition-colors ${
                          sel
                            ? "bg-terracotta text-cream"
                            : "border border-cream/70 bg-cream/30 backdrop-blur"
                        }`}
                      >
                        {sel ? "✓" : ""}
                      </span>
                    </div>
                    <div className="bg-surface px-3 py-3">
                      <p className="font-serif text-[15px] leading-[1.2] text-ink">
                        {s.name}
                      </p>
                      <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.12em] text-ink-4">
                        {s.mood}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 3 — Generate */}
          <section className="rounded-xl border border-line-soft bg-surface p-6 md:p-8">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.1] tracking-[-0.01em] text-ink">
                  3. Generate
                </h2>
                <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
                  You&apos;re ready to create beautiful lifestyle images.
                </p>
              </div>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={submit}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Starting…" : "Generate images"}
              </button>
            </div>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
              {sceneIds.length} scene{sceneIds.length === 1 ? "" : "s"} selected ·
              Cost:{" "}
              <span className="text-terracotta">
                {total} credit{total === 1 ? "" : "s"}
              </span>
            </p>
            {error ? (
              <div className="mt-4 rounded-md border border-terracotta/30 bg-terracotta-wash px-4 py-3 text-[14px] text-terracotta-dark">
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
          </section>
        </div>

        {/* Right summary panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-line bg-surface p-6">
            <h2 className="font-serif text-[18px] leading-[1.15] tracking-[-0.005em] text-ink">
              Batch summary
            </h2>

            <div className="mt-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                {files.length} product {files.length === 1 ? "photo" : "photos"}
              </p>
              {files[0] ? (
                <div className="mt-3 flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-line-soft bg-paper-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrls[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="truncate text-[13px] text-ink-2">{files[0].name}</p>
                </div>
              ) : (
                <p className="mt-3 text-[13px] text-ink-4">
                  No photo uploaded yet.
                </p>
              )}
            </div>

            <div className="mt-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                {selectedScenes.length} scene{selectedScenes.length === 1 ? "" : "s"} selected
              </p>
              {selectedScenes.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {selectedScenes.map((s) => (
                    <li key={s.slug} className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-line-soft bg-paper-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="flex-1 truncate text-[13px] text-ink-2">
                        {s.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleScene(s.slug)}
                        aria-label={`Remove ${s.name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-4 transition-colors hover:bg-paper-2 hover:text-ink"
                      >
                        <span aria-hidden>×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[13px] text-ink-4">No scenes selected.</p>
              )}
            </div>

            <div className="mt-6 flex items-baseline justify-between border-t border-line-soft pt-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                Est. credits to use
              </p>
              <p className="font-serif text-[20px] tabular-nums text-ink">
                {total}
              </p>
            </div>

            <div className="mt-5 rounded-md border border-line-soft bg-paper-soft p-4">
              <p className="text-[13px] font-medium text-ink">
                You have {credits} credits
              </p>
              <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-3">
                {total > 0 && credits >= total
                  ? "Plenty for this batch."
                  : "Upgrade for more credits."}
              </p>
              <Link
                href="/pricing"
                className="mt-2 inline-block font-mono text-[11px] uppercase tracking-[0.12em] text-terracotta transition-colors hover:text-terracotta-dark"
              >
                View plans <span aria-hidden>→</span>
              </Link>
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Starting…" : "Continue to review"}
            </button>
            <p className="mt-3 text-center text-[12px] leading-[1.4] text-ink-3">
              You can review and adjust before generating.
            </p>
          </div>
        </aside>
      </div>
    </div>
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
    <li className="relative flex gap-4">
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
