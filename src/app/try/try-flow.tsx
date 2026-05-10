/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { Crown } from "lucide-react";
import type { Scene } from "@/lib/db/scenes";
import { track } from "@/lib/analytics";
import { isNonProdEnv } from "@/lib/env.client";
import { Container } from "@/components/ui/container";
import { MockGenToggle } from "@/components/dev/mock-gen-toggle";
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
import { OfferCard } from "./offer-card";

const PENDING_BATCH_KEY = "vd_pending_batch";
const TRY_INTENT_KEY = "vd_try_intent";

type TryIntent = {
  sourceUrl: string;
  photoName: string;
  photoMimeType: string;
  pickedScenes: string[];
};

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
// Authed users can pick up to 5 scenes per batch. Unauth visitors get
// 3 picks: the first is a free watermarked preview, the other two are
// locked behind the $9.99 unlock CTA. All 3 are real generations whose
// raw URLs become available post-payment.
const MAX_TRY_SCENES = 5;
const MAX_TRY_SCENES_UNAUTH = 3;

type Photo = { url: string; name: string; isObjectUrl: boolean; file: File | null };

export function TryFlow({
  scenes,
  isAdmin = false,
  isAuthed = false,
}: {
  scenes: Scene[];
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
  // Hydration of post-login intent must happen post-mount so SSR and
  // client first-paint match. Until `hydrated` flips, the URL-correction
  // effect is suppressed so a freshly-returned `?step=develop` doesn't
  // get bounced back to upload before sessionStorage is read.
  // The conversion gate has moved to the download click in DevelopStep,
  // so the previous pre-develop AuthModal + intent-persistence path is
  // dormant — the hydration block below remains as a no-op fallback for
  // any in-flight visitors (and a hook point for future cross-device
  // resume work; see /api/try/{save,consume}-intent).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isAuthed) {
      setHydrated(true);
      return;
    }
    let cancelled = false;
    (async () => {
      // Same-device fast path: localStorage hits without a network
      // round-trip. (sessionStorage fallback covers any in-flight users
      // who stored their intent before this change rolled out.)
      let restored: TryIntent | null = null;
      try {
        const raw =
          window.localStorage.getItem(TRY_INTENT_KEY) ??
          window.sessionStorage.getItem(TRY_INTENT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as TryIntent;
          if (
            parsed &&
            typeof parsed.sourceUrl === "string" &&
            Array.isArray(parsed.pickedScenes) &&
            parsed.pickedScenes.length > 0
          ) {
            restored = parsed;
          }
        }
        window.localStorage.removeItem(TRY_INTENT_KEY);
        window.sessionStorage.removeItem(TRY_INTENT_KEY);
      } catch {}

      // Cross-device fallback: localStorage was empty (the user clicked
      // the confirmation email on a different device than where they
      // uploaded). Look up the latest unconsumed intent for this user's
      // email and consume it. POST so the response is never cached.
      if (!restored) {
        try {
          const res = await fetch("/api/try/consume-intent", {
            method: "POST",
          });
          if (res.ok) {
            const data = (await res.json()) as { intent: TryIntent | null };
            if (
              data.intent &&
              typeof data.intent.sourceUrl === "string" &&
              Array.isArray(data.intent.pickedScenes) &&
              data.intent.pickedScenes.length > 0
            ) {
              restored = data.intent;
            }
          }
        } catch {}
      }

      if (cancelled) return;
      if (restored) {
        setPhoto({
          url: restored.sourceUrl,
          name: restored.photoName,
          isObjectUrl: false,
          file: null,
        });
        setPickedScenes(restored.pickedScenes);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

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

  // Sync URL back if the URL step is unreachable given current state.
  // Wait for sessionStorage hydration to finish — otherwise a returning
  // user lands on ?step=develop, gets redirected to upload, and *then*
  // we restore their photo + scenes a tick too late.
  useEffect(() => {
    if (!hydrated) return;
    if (urlStep !== effectiveStep) {
      goToStep(effectiveStep, "replace");
    }
  }, [hydrated, urlStep, effectiveStep, goToStep]);

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

  const sceneCap = isAuthed ? MAX_TRY_SCENES : MAX_TRY_SCENES_UNAUTH;

  const togglePickedScene = useCallback(
    (id: string) => {
      setPickedScenes((p) => {
        if (p.includes(id)) return p.filter((x) => x !== id);
        if (p.length >= sceneCap) return p;
        const next = [...p, id];
        track("try_scene_picked", { slug: id, total_picked: next.length });
        return next;
      });
    },
    [sceneCap],
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Global <Nav /> is rendered by /try/page.tsx — no second header
          here. The wizard step indicator below remains, scoped to the
          /try flow. */}
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
            sceneCap={sceneCap}
            onToggle={togglePickedScene}
            onBack={() => goToStep("upload", "replace")}
            onContinue={() => {
              // Authed and unauth follow the same path now: straight to
              // the develop step. Generation runs unauthenticated and
              // returns watermarked previews; the conversion gate
              // (AuthModal) appears later, when the user clicks Download
              // on a tile. See DevelopStep below.
              setDevelopDone(false);
              goToStep("develop");
              track("try_develop_started", {
                scene_count: pickedScenes.length,
              });
            }}
          />
        ) : null}

        {step === "develop" ? (
          <DevelopStep
            photo={photo}
            picked={pickedScenes}
            sceneById={sceneById}
            scenes={scenes}
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
      {isAdmin && isNonProdEnv ? <MockGenToggle /> : null}
    </div>
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
  sceneCap,
  busy = false,
  onToggle,
  onBack,
  onContinue,
}: {
  scenes: Scene[];
  picked: string[];
  sceneCap: number;
  busy?: boolean;
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
          const atCap = !on && picked.length >= sceneCap;
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
                {s.isPro ? (
                  <div
                    className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-ink/55 backdrop-blur-sm"
                    style={{ color: "#e4b961" }}
                    title="Pro scene"
                  >
                    <Crown aria-hidden className="h-3.5 w-3.5" fill="currentColor" />
                    <span className="sr-only">Pro scene</span>
                  </div>
                ) : null}
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
          {picked.length} of {sceneCap} scene{picked.length === 1 ? "" : "s"} picked
        </p>
        <button
          type="button"
          data-testid="generate-button"
          disabled={picked.length === 0 || busy}
          onClick={onContinue}
          className="inline-flex items-center rounded-full bg-terracotta px-6 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Loading…" : "Develop my batch →"}
        </button>
      </div>
    </div>
  );
}

function DevelopStep({
  photo,
  picked,
  sceneById,
  scenes,
  developDone,
  variant,
  isAuthed,
  onComplete,
  onReset,
}: {
  photo: Photo | null;
  picked: string[];
  sceneById: Record<string, Scene>;
  scenes: Scene[];
  developDone: boolean;
  variant: DevelopGridVariant;
  isAuthed: boolean;
  onComplete: () => void;
  onReset: () => void;
}) {
  const router = useRouter();

  const [generationResults, setGenerationResults] = useState<TileResult[]>(() =>
    picked.map((slug, i) => ({
      sceneSlug: slug,
      sceneName: sceneById[slug]?.name ?? slug,
      isFreePreview: !isAuthed && i === 0,
      softLocked: !isAuthed && i > 0,
      status: "pending" as const,
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
  const [serverSourceUrl, setServerSourceUrl] = useState<string | null>(
    photo && !photo.file && /^https?:/.test(photo.url) ? photo.url : null,
  );
  const [hydratedFile, setHydratedFile] = useState<File | null>(null);
  const claimRanRef = useRef(false);

  useEffect(() => {
    if (!photo) return;
    if (photo.file) return;
    if (!/^https?:/.test(photo.url)) return;
    if (hydratedFile) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(photo.url);
        if (!res.ok) return;
        const blob = await res.blob();
        const mime = blob.type || "image/jpeg";
        const file = new File([blob], photo.name || "source.jpg", { type: mime });
        if (!cancelled) setHydratedFile(file);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [photo, hydratedFile]);

  const effectiveFile: File | null = photo?.file ?? hydratedFile;

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
      // localStorage (not session) so the pending batch survives the
      // user closing the tab to check their email for the confirmation
      // link. /app/library's claim-handler reads localStorage on mount,
      // calls /api/try/claim, then clears the key. sessionStorage write
      // is kept as belt-and-braces for stale tabs that haven't loaded
      // the localStorage variant yet.
      window.localStorage.setItem(PENDING_BATCH_KEY, JSON.stringify(payload));
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

  const displayResults: TileResult[] = generationResults;

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

  // Unlock CTA — fired by locked tile clicks AND the offer card.
  // Persists the batch to mint a token, then redirects to Stripe Checkout.
  // Until the batch finishes generating we open AuthModal as a soft fallback
  // so the click feels responsive instead of dead.
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const handleUnlockClick = useCallback(async () => {
    track("try_unlock_clicked");
    if (unlockSubmitting) return;
    const succeeded = generationResults.filter(
      (r) => r.status === "succeeded" && r.outputUrl,
    );
    if (succeeded.length < picked.length) {
      // Still generating — fall back to the auth modal so the click isn't
      // a dead-end. The user can retry the unlock once the batch finishes.
      track("try_signup_clicked", { intent: "unlock" });
      openAuthModal("unlock");
      return;
    }
    setUnlockSubmitting(true);
    try {
      const res = await fetch("/api/try/finalize-batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          generations: succeeded.map((r) => ({
            sceneSlug: r.sceneSlug,
            sceneName: r.sceneName,
            outputUrl: r.outputUrl as string,
            ...(r.rawUrl ? { rawUrl: r.rawUrl } : {}),
            isFreePreview: Boolean(r.isFreePreview),
          })),
        }),
      });
      if (!res.ok) {
        setUnlockSubmitting(false);
        track("try_signup_clicked", { intent: "unlock" });
        openAuthModal("unlock");
        return;
      }
      const data = (await res.json()) as { token?: string };
      if (!data.token) {
        setUnlockSubmitting(false);
        openAuthModal("unlock");
        return;
      }
      window.location.href = `/api/stripe/unlock-checkout?batchToken=${data.token}`;
    } catch {
      setUnlockSubmitting(false);
      openAuthModal("unlock");
    }
  }, [unlockSubmitting, generationResults, picked, openAuthModal]);

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

      <div
        className={`mb-10 grid grid-cols-1 items-start gap-8 ${
          isAuthed
            ? "md:grid-cols-[260px_1fr] md:gap-12"
            : "md:grid-cols-[220px_minmax(0,1fr)_300px] md:gap-8"
        }`}
      >
        <div className={isAuthed ? undefined : "order-2 md:order-1"}>
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

        <div className={isAuthed ? undefined : "order-1 md:order-2"}>
          {generationResults.some((r) => r.status === "pending") && photo && effectiveFile && sceneById[picked[0]] ? (
            <ProgressScreen
              file={effectiveFile}
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
              onDownloadClick={handleDownloadClick}
              onUnlockClick={isAuthed ? undefined : handleUnlockClick}
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
                    return {
                      ...r,
                      status: "failed",
                      error: hit.error ?? "failed",
                      errorCode: hit.errorCode,
                    };
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
              onUnlockClick={isAuthed ? undefined : handleUnlockClick}
            />
          )}

          {!isAuthed ? <UnlockArrowAnnotation /> : null}
        </div>

        {!isAuthed ? (
          <div className="order-3 md:sticky md:top-24 md:self-start">
            <OfferCard onUnlock={handleUnlockClick} />
          </div>
        ) : null}
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

// Decorative flourish placed below cards 2 & 3, pointing up at the
// locked tiles. The arrow is a tiny inline SVG curve in terracotta;
// the copy is italic serif. It sits inside the cards-column flow so
// it inherits the same horizontal bounds as the locked tiles above.
function UnlockArrowAnnotation() {
  return (
    <div className="mt-4 hidden items-end justify-end pr-[12%] sm:flex">
      <div className="relative max-w-[260px] text-right">
        <p className="font-serif text-[14px] italic leading-[1.35] text-zinc-600">
          Unlock the remaining 2 images
          <br />
          for high-res downloads.
        </p>
        <svg
          aria-hidden
          width="80"
          height="44"
          viewBox="0 0 80 44"
          className="absolute -top-8 -right-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--terracotta, #c2451c)" }}
        >
          <path d="M2 40 C 18 32, 32 22, 50 12 C 58 8, 66 6, 74 4" />
          <path d="M68 2 L 74 4 L 72 10" />
        </svg>
      </div>
    </div>
  );
}


