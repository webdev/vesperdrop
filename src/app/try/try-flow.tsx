/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type { Scene } from "@/lib/db/scenes";
import { track } from "@/lib/analytics";
import { isNonProdEnv } from "@/lib/env.client";
import { Container } from "@/components/ui/container";
import { WizardSteps, type StepId } from "./wizard-steps";

function parseStep(raw: string | null): StepId {
  return raw === "scenes" || raw === "develop" ? raw : "upload";
}
import { ExampleInput } from "./example-input";
import {
  DevelopGrid,
  type DevelopGridVariant,
  type TileResult,
} from "./develop-grid";
import { ProgressScreen } from "./progress-screen";
import { SignUpBar } from "./sign-up-bar";
import { SavedBar } from "./saved-bar";
import { AuthModal } from "./auth-modal";

const LOCKED_TILE_SLUG = "__locked__";
const PENDING_BATCH_KEY = "vd_pending_batch";

type AuthIntent = "default" | "download" | "unlock";
type AuthModalState = { open: boolean; intent: AuthIntent };

type PendingBatch = {
  source: { url?: string; name: string };
  generations: Array<{
    sceneSlug: string;
    sceneName: string;
    outputUrl: string;
    rawUrl?: string;
  }>;
};

const SAMPLE_SRC = "/marketing/before-after/cami_before.png";
const SAMPLE_NAME = "CAM-BRN-S_SAMPLE.JPG";
const MAX_TRY_SCENES = 5;

type Photo = { url: string; name: string; isObjectUrl: boolean; file: File | null };

export function TryFlow({
  scenes,
  firstName,
  isAdmin = false,
  isAuthed = false,
}: {
  scenes: Scene[];
  firstName: string | null;
  isAdmin?: boolean;
  isAuthed?: boolean;
}) {
  const sceneById = scenes.reduce<Record<string, Scene>>(
    (acc, s) => ({ ...acc, [s.slug]: s }),
    {},
  );
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [pickedScenes, setPickedScenes] = useState<string[]>([]);
  const [developDone, setDevelopDone] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStep = parseStep(searchParams.get("step"));
  const effectiveStep: StepId =
    urlStep === "develop" && (!photo || pickedScenes.length === 0)
      ? photo
        ? "scenes"
        : "upload"
      : urlStep === "scenes" && !photo
        ? "upload"
        : urlStep;
  const step = effectiveStep;

  const goToStep = useCallback(
    (next: StepId, mode: "push" | "replace" = "push") => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "upload") params.delete("step");
      else params.set("step", next);
      const qs = params.toString();
      const href = qs ? `/try?${qs}` : "/try";
      if (mode === "replace") router.replace(href);
      else router.push(href);
    },
    [router, searchParams],
  );

  // Sync URL back if the URL step is unreachable given current state
  useEffect(() => {
    if (urlStep !== effectiveStep) {
      goToStep(effectiveStep, "replace");
    }
  }, [urlStep, effectiveStep, goToStep]);

  const variant: DevelopGridVariant = useMemo(() => {
    const fx = searchParams.get("fx");
    return fx === "grain" ? "grain" : "darkroom";
  }, [searchParams]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  const handleFiles = useCallback(
    (files: FileList | null, source: "drop" | "browse" = "browse") => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) return;
      if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
      const url = URL.createObjectURL(file);
      setPhoto({ url, name: file.name, isObjectUrl: true, file });
      goToStep("scenes");
      track("try_upload_started", { source });
    },
    [photo, goToStep],
  );

  const useSample = useCallback(() => {
    if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
    setPhoto({ url: SAMPLE_SRC, name: SAMPLE_NAME, isObjectUrl: false, file: null });
    goToStep("scenes");
    track("try_upload_started", { source: "sample" });
  }, [photo, goToStep]);

  const resetAll = useCallback(() => {
    if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setPickedScenes([]);
    setDevelopDone(false);
    goToStep("upload", "replace");
  }, [photo, goToStep]);

  const togglePickedScene = useCallback((id: string) => {
    setPickedScenes((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= MAX_TRY_SCENES) return p;
      const next = [...p, id];
      track("try_scene_picked", { slug: id, total_picked: next.length });
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-line-soft bg-paper">
        <Container width="app" className="flex items-center justify-between py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-serif text-[22px] font-medium tracking-tight text-ink transition-colors hover:text-terracotta"
          >
            <span aria-hidden>←</span> Vesperdrop
          </Link>
          <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            {firstName ? (
              <>
                <span className="text-ink">Hello, {firstName}</span>
                <form action="/api/auth/sign-out" method="post">
                  <button
                    type="submit"
                    className="text-ink-3 transition-colors hover:text-ink"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <span className="text-ink-3">
                Have an account?{" "}
                <Link
                  href="/sign-in"
                  className="text-ink underline-offset-4 hover:text-terracotta hover:underline"
                >
                  Sign in
                </Link>
              </span>
            )}
          </div>
        </Container>
      </header>

      <WizardSteps current={step} />

      <Container as="main" width="app" className="flex-1 py-10 md:py-16">
        {step === "upload" ? (
          <UploadStep
            photo={photo}
            fileInputRef={fileInputRef}
            onFiles={handleFiles}
            onUseSample={useSample}
          />
        ) : null}

        {step === "scenes" ? (
          <ScenesStep
            scenes={scenes}
            picked={pickedScenes}
            onToggle={togglePickedScene}
            onBack={() => goToStep("upload", "replace")}
            onContinue={() => {
              setDevelopDone(false);
              goToStep("develop");
              track("try_develop_started", { scene_count: pickedScenes.length });
            }}
          />
        ) : null}

        {step === "develop" ? (
          <DevelopStep
            photo={photo}
            picked={pickedScenes}
            sceneById={sceneById}
            developDone={developDone}
            variant={variant}
            isAuthed={isAuthed}
            onComplete={() => {
              setDevelopDone(true);
              track("try_develop_complete", {
                scene_count: pickedScenes.length,
              });
            }}
            onReset={resetAll}
          />
        ) : null}
      </Container>
      {isAdmin && isNonProdEnv ? <AdminMockToggle /> : null}
    </div>
  );
}

const MOCK_CHANGE_EVENT = "vd_mock_change";

function subscribeMockCookie(callback: () => void) {
  window.addEventListener(MOCK_CHANGE_EVENT, callback);
  return () => window.removeEventListener(MOCK_CHANGE_EVENT, callback);
}
function readMockCookie() {
  return document.cookie.split("; ").some((c) => c === "vd_mock_gen=1");
}
function readMockCookieServer() {
  return false;
}

function AdminMockToggle() {
  const on = useSyncExternalStore(
    subscribeMockCookie,
    readMockCookie,
    readMockCookieServer,
  );
  const toggle = () => {
    document.cookie = !on
      ? `vd_mock_gen=1; path=/; max-age=86400; samesite=lax`
      : `vd_mock_gen=; path=/; max-age=0; samesite=lax`;
    window.dispatchEvent(new Event(MOCK_CHANGE_EVENT));
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] shadow-card hover:border-terracotta"
      aria-label="Toggle mock generation"
    >
      Mock gen:{" "}
      <span
        suppressHydrationWarning
        className={on ? "text-terracotta" : "text-ink-3"}
      >
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}

function UploadStep({
  photo,
  fileInputRef,
  onFiles,
  onUseSample,
}: {
  photo: Photo | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null, source?: "drop" | "browse") => void;
  onUseSample: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.2fr_1fr] md:gap-16">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          New batch · N°01
        </p>
        <h1 className="mt-4 font-serif text-[clamp(3rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.02em] text-ink">
          Drop your{" "}
          <em className="not-italic font-serif italic text-terracotta-dark">
            product
          </em>
          .
        </h1>
        <p className="mt-5 max-w-lg text-[16px] leading-[1.55] text-ink-3">
          Any flatlay works — on the floor, on a rug, on your desk. Your Amazon
          main image is perfect.
        </p>

        {photo ? (
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
            On file · {photo.name} · drop a different one to replace
          </p>
        ) : null}

        <div className="mt-8">
          <Dropzone
            dragging={dragging}
            setDragging={setDragging}
            fileInputRef={fileInputRef}
            onFiles={onFiles}
            onUseSample={onUseSample}
          />
        </div>
      </div>

      <div className="md:pt-12">
        <ExampleInput paused={photo !== null} />
      </div>
    </div>
  );
}

function Dropzone({
  dragging,
  setDragging,
  fileInputRef,
  onFiles,
  onUseSample,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null, source?: "drop" | "browse") => void;
  onUseSample: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files, "drop");
        }}
        className={`block w-full cursor-pointer rounded-lg border border-dashed px-8 py-14 text-center transition-colors ${
          dragging
            ? "border-terracotta bg-terracotta-wash/40"
            : "border-line bg-surface hover:border-ink-4"
        }`}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-paper-2 text-ink-2">
          <span aria-hidden className="font-serif text-[24px] leading-none">↑</span>
        </div>
        <div className="font-serif text-[clamp(1.125rem,1.5vw,1.25rem)] leading-tight text-ink">
          Drag a product photo here
        </div>
        <div className="mt-2 text-[14px] text-ink-3">
          or{" "}
          <span className="text-terracotta underline underline-offset-4">
            browse files
          </span>{" "}
          · PNG, JPG up to 40MB
        </div>
        <div className="mt-6 border-t border-line-soft pt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
          No account · no card · stays in your browser
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFiles(e.target.files, "browse")}
      />
      <div className="mt-4 text-[14px] text-ink-3">
        Don&apos;t have one handy?{" "}
        <button
          type="button"
          onClick={onUseSample}
          className="text-terracotta underline underline-offset-4 transition-colors hover:text-terracotta-dark"
        >
          Use a sample product →
        </button>
      </div>
    </>
  );
}

function ScenesStep({
  scenes,
  picked,
  onToggle,
  onBack,
  onContinue,
}: {
  scenes: Scene[];
  picked: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  function onCardKey(e: ReactKeyboardEvent<HTMLButtonElement>, id: string) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onToggle(id);
    }
  }
  return (
    <div>
      <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Scenes · N°02
          </p>
          <h1 className="mt-4 font-serif text-[clamp(2.5rem,5.5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-ink">
            Pick your{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              scenes
            </em>
            .
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-[1.55] text-ink-3">
            Choose the looks you want. We&apos;ll spread your batch across them.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="self-start font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline md:self-end"
        >
          ← Back to upload
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {scenes.map((s) => {
          const on = picked.includes(s.slug);
          const atCap = !on && picked.length >= MAX_TRY_SCENES;
          return (
            <button
              key={s.slug}
              type="button"
              data-testid="scene-card"
              onClick={() => onToggle(s.slug)}
              onKeyDown={(e) => onCardKey(e, s.slug)}
              disabled={atCap}
              className="group block text-left disabled:cursor-not-allowed disabled:opacity-50"
              aria-pressed={on}
            >
              <div
                className={`relative aspect-[4/5] overflow-hidden rounded-md transition-all ${
                  on
                    ? "outline outline-[3px] outline-terracotta -outline-offset-[3px]"
                    : "outline outline-1 outline-line-soft -outline-offset-1"
                }`}
              >
                <img
                  src={s.imageUrl}
                  alt={s.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/65" />
                {on ? (
                  <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-terracotta font-mono text-xs text-cream">
                    <span aria-hidden>✓</span>
                  </div>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-10 text-cream">
                  <h3 className="font-serif text-[clamp(1.25rem,2vw,1.625rem)] leading-[1.1] tracking-[-0.01em]">
                    {s.name}
                  </h3>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/85">
                    {s.mood}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-line-soft pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          {picked.length} of {MAX_TRY_SCENES} scene{picked.length === 1 ? "" : "s"} picked
        </p>
        <button
          type="button"
          data-testid="generate-button"
          disabled={picked.length === 0}
          onClick={onContinue}
          className="inline-flex items-center rounded-full bg-terracotta px-6 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Develop my batch →
        </button>
      </div>
    </div>
  );
}

function DevelopStep({
  photo,
  picked,
  sceneById,
  developDone,
  variant,
  isAuthed,
  onComplete,
  onReset,
}: {
  photo: Photo | null;
  picked: string[];
  sceneById: Record<string, Scene>;
  developDone: boolean;
  variant: DevelopGridVariant;
  isAuthed: boolean;
  onComplete: () => void;
  onReset: () => void;
}) {
  const router = useRouter();

  const [generationResults, setGenerationResults] = useState<TileResult[]>(() =>
    picked.map((slug) => ({
      sceneSlug: slug,
      sceneName: sceneById[slug]?.name ?? slug,
      status: "pending",
    })),
  );

  const [authModal, setAuthModal] = useState<AuthModalState>({
    open: false,
    intent: "default",
  });

  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">(
    "saving",
  );
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [serverSourceUrl, setServerSourceUrl] = useState<string | null>(null);
  const claimRanRef = useRef(false);

  const allSettled =
    generationResults.length > 0 &&
    generationResults.every((r) => r.status !== "pending");
  const anySucceeded = generationResults.some((r) => r.status === "succeeded");

  useEffect(() => {
    if (allSettled && anySucceeded && !developDone) onComplete();
  }, [allSettled, anySucceeded, developDone, onComplete]);

  useEffect(() => {
    if (isAuthed) return;
    if (!photo || !anySucceeded) return;
    if (typeof window === "undefined") return;
    const succeeded = generationResults.filter(
      (r) => r.status === "succeeded" && r.outputUrl,
    );
    if (succeeded.length === 0) return;
    const payload: PendingBatch = {
      source: serverSourceUrl
        ? { url: serverSourceUrl, name: photo.name }
        : { name: photo.name },
      generations: succeeded.map((r) => ({
        sceneSlug: r.sceneSlug,
        sceneName: r.sceneName,
        outputUrl: r.outputUrl as string,
        ...(r.rawUrl ? { rawUrl: r.rawUrl } : {}),
      })),
    };
    try {
      window.sessionStorage.setItem(PENDING_BATCH_KEY, JSON.stringify(payload));
    } catch {}
  }, [generationResults, photo, anySucceeded, isAuthed, serverSourceUrl]);

  // Authed: auto-claim once developDone fires. No modal, no prompt.
  useEffect(() => {
    if (!isAuthed || !developDone || !photo || claimRanRef.current) return;
    const succeeded = generationResults.filter(
      (r) => r.status === "succeeded" && r.outputUrl,
    );
    if (succeeded.length === 0) return;
    claimRanRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/try/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: serverSourceUrl
              ? { url: serverSourceUrl, name: photo.name }
              : { name: photo.name },
            generations: succeeded.map((r) => ({
              sceneSlug: r.sceneSlug,
              sceneName: r.sceneName,
              outputUrl: r.outputUrl as string,
              ...(r.rawUrl ? { rawUrl: r.rawUrl } : {}),
            })),
          }),
        });
        if (!res.ok) {
          setSaveStatus("error");
          return;
        }
        const data = (await res.json()) as { runId?: string };
        setSavedRunId(data.runId ?? null);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    })();
  }, [isAuthed, developDone, photo, generationResults, serverSourceUrl]);

  const displayResults: TileResult[] = useMemo(() => {
    if (!anySucceeded || isAuthed) return generationResults;
    const lockedTile: TileResult = {
      sceneSlug: LOCKED_TILE_SLUG,
      sceneName: "BONUS",
      status: "locked",
    };
    return [...generationResults, lockedTile];
  }, [generationResults, anySucceeded, isAuthed]);

  const openAuthModal = useCallback((intent: AuthIntent) => {
    setAuthModal({ open: true, intent });
  }, []);

  const triggerDirectDownload = useCallback((url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const handleDownloadClick = useCallback(
    (slug: string) => {
      track("try_tile_download_clicked", { slug });
      if (isAuthed) {
        const tile = generationResults.find((r) => r.sceneSlug === slug);
        if (tile?.outputUrl) {
          triggerDirectDownload(
            tile.outputUrl,
            `${tile.sceneName.toLowerCase().replace(/\s+/g, "-")}.png`,
          );
        }
        return;
      }
      track("try_signup_clicked", { intent: "download", slug });
      openAuthModal("download");
    },
    [isAuthed, generationResults, triggerDirectDownload, openAuthModal],
  );

  const handleLockedClick = useCallback(() => {
    track("try_locked_tile_clicked");
    track("try_signup_clicked", { intent: "unlock" });
    openAuthModal("unlock");
  }, [openAuthModal]);

  const handleBarSignUpClick = useCallback(() => {
    openAuthModal("default");
  }, [openAuthModal]);

  const handleAuthSuccess = useCallback(async () => {
    setAuthModal((s) => ({ ...s, open: false }));
    router.push("/app/library");
  }, [router]);

  return (
    <div className={`relative ${developDone ? "pb-40 md:pb-44" : ""}`}>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Developing · N°03
          </p>
          <h1 className="mt-4 font-serif text-[clamp(2.5rem,5.5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-ink">
            In the{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              studio
            </em>
            .
          </h1>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 items-start gap-8 md:grid-cols-[260px_1fr] md:gap-12">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
            Your product
          </p>
          {photo ? (
            <div className="mt-3 aspect-square overflow-hidden rounded-md border border-line-soft bg-surface">
              <img
                src={photo.url}
                alt={photo.name}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="mt-3 flex aspect-square items-center justify-center rounded-md border border-line-soft bg-paper-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
              No product
            </div>
          )}

          <div className="mt-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
              Scenes · {picked.length}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {picked.map((id) => (
                <span
                  key={id}
                  className="rounded-full border border-terracotta/30 bg-terracotta-wash px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta-dark"
                >
                  {sceneById[id]?.name ?? id}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          {generationResults.every((r) => r.status === "pending") && photo?.file && sceneById[picked[0]] ? (
            <ProgressScreen
              file={photo.file}
              sceneSlugs={picked}
              userPhotoUrl={photo.url}
              primaryPreset={{
                slug: sceneById[picked[0]].slug,
                name: sceneById[picked[0]].name,
                mood: sceneById[picked[0]].mood,
                palette: sceneById[picked[0]].palette,
                category: sceneById[picked[0]].category,
              }}
              presetMetaBySlug={Object.fromEntries(
                picked.map((slug) => [
                  slug,
                  {
                    slug: sceneById[slug]?.slug ?? slug,
                    name: sceneById[slug]?.name ?? slug,
                    mood: sceneById[slug]?.mood ?? "",
                    palette: sceneById[slug]?.palette ?? [],
                    category: sceneById[slug]?.category ?? "",
                  },
                ]),
              )}
              variant={variant}
              initialResults={generationResults}
              onSourceUrl={(url) => setServerSourceUrl(url)}
              onSettled={(out) => {
                setGenerationResults((prev) =>
                  prev.map((r) => {
                    const hit = out.find((o) => o.slug === r.sceneSlug);
                    if (!hit) return r;
                    if (hit.outputUrl) {
                      return {
                        ...r,
                        status: "succeeded",
                        outputUrl: hit.outputUrl,
                        rawUrl: hit.rawUrl,
                      };
                    }
                    return { ...r, status: "failed", error: hit.error ?? "failed" };
                  }),
                );
                for (const item of out) {
                  if (item.outputUrl) track("try_generate_succeeded", { slug: item.slug });
                  else track("try_generate_failed", { slug: item.slug, error: item.error ?? "failed" });
                }
              }}
            />
          ) : (
            <DevelopGrid
              results={displayResults}
              variant={variant}
              sourceUrl={photo?.url}
              onDownloadClick={handleDownloadClick}
              onLockedClick={handleLockedClick}
            />
          )}
        </div>
      </div>

      {developDone ? (
        isAuthed ? (
          <SavedBar status={saveStatus} runId={savedRunId} onReset={onReset} />
        ) : (
          <SignUpBar onReset={onReset} onSignUpClick={handleBarSignUpClick} />
        )
      ) : null}

      {isAuthed ? null : (
        <AuthModal
          open={authModal.open}
          onOpenChange={(open) => setAuthModal((s) => ({ ...s, open }))}
          intent={authModal.intent}
          onAuthSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}

