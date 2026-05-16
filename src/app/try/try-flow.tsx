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
import { SavedBar } from "./saved-bar";
import { AuthModal } from "./auth-modal";
import { OtpAuthFlow } from "@/components/app/otp-auth-flow";
import { motion } from "framer-motion";
import { EditorialClaimRail, TrustRow } from "./editorial-rail";
import {
  AdaptiveStudioLayout,
  SingleImageHeroLayout,
} from "./adaptive-studio-layout";
import { Lightbox } from "./lightbox";

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

// Match the server's 32-hex token format (`randomBytes(16).toString("hex")`)
// using Web Crypto so the URL can flip to /try/b/<token> the instant
// DevelopStep mounts — before any network round-trip to mint the row.
function mintClientBatchToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Vocabulary mirrors sceneify's ModelRace enum
// (src/lib/db/schema.ts in sceneify and SceneifyCastingRace in
// src/lib/ai/sceneify.ts here). One race per batch, applied to every
// tile so the 3 generated shots read as the same person. Uniform over
// the full set — sceneify gracefully falls back to its default sampler
// for presets that have no references tagged for the chosen race, so
// missing coverage degrades quality but never errors.
const CASTING_RACES = [
  "white",
  "black",
  "east_asian",
  "south_asian",
  "southeast_asian",
  "latino",
  "middle_eastern",
  "mixed",
] as const;

function pickRandomCastingRace(): string {
  const i = Math.floor(Math.random() * CASTING_RACES.length);
  return CASTING_RACES[i];
}
// Both authed and unauth visitors can pick up to 6 scenes per batch.
// For unauth visitors the first scene is the free watermarked preview;
// the rest are locked behind the $9.99 unlock CTA. All scenes are real
// generations whose raw URLs become available post-payment. Cap matches
// the editorial Studio frame's 3x2 grid (StudioDevelopFrame).
// Authed visitors can pick up to 6 scenes per batch; unauth visitors
// are capped at 3 — that's the free-tier ceiling, where index 0 is the
// free hero preview and indexes 1–2 are unlockable for $9.99 (or both
// as a $14.99 bundle in State C). See CLAUDE.md → Free-tier funnel.
const MAX_TRY_SCENES = 6;
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
  // history.replaceState in DevelopStep moves the URL to /try/b/<token>
  // once finalize-batch resolves (so the batch is deep-linkable + back-
  // button-safe). useSearchParams observes that pathname change and
  // re-derives `step` as "upload" since /try/b/<token> has no ?step=
  // param. Pin to "develop" whenever the pathname is the batch URL so
  // the wizard doesn't collapse the user back to UploadStep mid-flow.
  const onBatchPath =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/try/b/");
  const urlStep: StepId = onBatchPath
    ? "develop"
    : parseStep(searchParams.get("step"));
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

      <Container as="main" width="app" className="flex-1 pt-6 pb-8 md:pt-10 md:pb-12">
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
      <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
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
        {/* Right-aligned action stack. The Develop CTA lives here too
            (in addition to the bottom action row) so it's reachable
            without scrolling once the user has picked at least one
            scene. Disabled state mirrors the bottom button. */}
        <div className="flex flex-col items-start gap-3 md:items-end">
          <button
            type="button"
            onClick={onBack}
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            ← Back to upload
          </button>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            {picked.length} of {sceneCap} scene{picked.length === 1 ? "" : "s"} picked
          </p>
          <button
            type="button"
            data-testid="generate-button-top"
            disabled={picked.length === 0 || busy}
            onClick={onContinue}
            className="inline-flex items-center rounded-full bg-terracotta px-6 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Loading…" : "Develop my batch →"}
          </button>
        </div>
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

  // Unauth claim state.
  //
  // `batchToken` is a 32-hex string that doubles as the URL token AND
  // (eventually) the unlock_batches primary key. We mint it client-side
  // at DevelopStep mount so the URL can flip to /try/b/<token> the
  // moment generation starts. `batchPersisted` flips true once
  // /api/try/finalize-batch lands — that's when Stripe checkout and
  // OTP claim can safely reference the token.
  //
  // `claimed` flips to true after attach-batch resolves and gates the
  // visual unlock on the free preview tile.
  const [batchToken] = useState<string>(() => mintClientBatchToken());
  // Random casting race for the whole batch — picked once and held for
  // the lifetime of DevelopStep so all N tiles render with the same
  // model identity. Uniform across sceneify's race vocabulary; tiles
  // for presets that lack tagged references just hit the fallback path
  // (unfiltered pool + explicit directive). See CLAUDE.md → Casting.
  const [batchCastingRace] = useState<string>(() => pickRandomCastingRace());
  const [batchPersisted, setBatchPersisted] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const finalizeRanRef = useRef(false);

  // Promote the URL to /try/b/<token> the moment the develop step
  // mounts for an unauth visitor. This is the canonical URL for the
  // batch's full lifecycle — refreshes that arrive mid-generation
  // (before finalize-batch persists the row) gracefully fall back to
  // /try?step=upload (handled by /try/b/[token]/page.tsx → notFound).
  useEffect(() => {
    if (isAuthed) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith(`/try/b/${batchToken}`)) return;
    window.history.replaceState({}, "", `/try/b/${batchToken}`);
  }, [isAuthed, batchToken]);

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
    // localStorage pending-batch was the magic-link era cross-device
    // handoff: /app/library's ClaimHandler would pick it up post-login
    // and POST /api/try/claim, bypassing the unlock_batches paywall.
    // The OTP-inline flow makes this dangerous: a user who happens to
    // click the (still-present) magic link in the email instead of
    // entering the code lands on /app/library and ClaimHandler hands
    // them un-paid access to all 3 generations. Drop the write
    // entirely — finalize-batch + attach-batch own the persistence
    // contract now. `payload` is intentionally unused.
    void payload;
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

  // Unauth: as soon as every generation lands, persist the batch using
  // the client-minted token. We pass `token` so finalize-batch uses it
  // as the primary key instead of minting a fresh one — the URL the
  // user has been looking at since DevelopStep mounted stays valid.
  useEffect(() => {
    if (isAuthed) return;
    if (finalizeRanRef.current) return;
    if (batchPersisted) return;
    const succeeded = generationResults.filter(
      (r) => r.status === "succeeded" && r.outputUrl,
    );
    if (succeeded.length === 0) return;
    if (succeeded.length !== generationResults.length) return;
    finalizeRanRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/try/finalize-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token: batchToken,
            // sourceUrl lands on each generation row's
            // sceneify_source_id column (mirrors /api/try/claim).
            // Falls back server-side to outputUrl[0] if absent so
            // older clients without this field don't 400.
            ...(serverSourceUrl ? { sourceUrl: serverSourceUrl } : {}),
            generations: succeeded.map((r) => ({
              sceneSlug: r.sceneSlug,
              sceneName: r.sceneName,
              outputUrl: r.outputUrl as string,
              ...(r.rawUrl ? { rawUrl: r.rawUrl } : {}),
              isFreePreview: Boolean(r.isFreePreview),
              focalPoint: r.focalPoint ?? null,
              faceBox: r.faceBox ?? null,
            })),
          }),
        });
        if (!res.ok) {
          finalizeRanRef.current = false;
          return;
        }
        setBatchPersisted(true);
      } catch {
        finalizeRanRef.current = false;
      }
    })();
  }, [isAuthed, generationResults, batchToken, batchPersisted, serverSourceUrl]);

  const displayResults: TileResult[] = generationResults;

  const openAuthModal = useCallback((intent: AuthIntent) => {
    setAuthModal({ open: true, intent });
  }, []);

  // Cross-origin URLs (Vercel Blob) ignore the <a download> attribute
  // unless the response sets Content-Disposition: attachment, so the
  // browser opens them in a new tab. Fetch as blob + object URL so
  // we get a same-origin URL that honors `download`.
  const triggerDirectDownload = useCallback(
    async (url: string, filename: string) => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } catch (err) {
        console.error("[try-flow] download failed", err);
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [],
  );

  // Once the user has claimed (OTP verified + batch attached) we know
  // there's an active client session even though `isAuthed` (from SSR)
  // is still false. Treat that as effectively authed for click-level
  // download intent so the free-preview tile downloads inline instead
  // of opening the now-deprecated AuthModal.
  const effectivelyAuthed = isAuthed || claimed;
  const handleDownloadClick = useCallback(
    (slug: string) => {
      track("try_tile_download_clicked", { slug });
      if (effectivelyAuthed) {
        const tile = generationResults.find((r) => r.sceneSlug === slug);
        if (tile?.outputUrl) {
          // Free preview tile post-claim: hand back the un-watermarked
          // rawUrl (HD). Everything else gets the watermarked outputUrl
          // — locked tiles aren't entitled to the raw until $9.99 paid.
          const isHeroUnlocked =
            tile.isFreePreview === true && claimed && Boolean(tile.rawUrl);
          const url = isHeroUnlocked ? (tile.rawUrl as string) : tile.outputUrl;
          void triggerDirectDownload(
            url,
            `${tile.sceneName.toLowerCase().replace(/\s+/g, "-")}.png`,
          );
        }
        return;
      }
      track("try_signup_clicked", { intent: "download", slug });
      openAuthModal("download");
    },
    [effectivelyAuthed, claimed, generationResults, triggerDirectDownload, openAuthModal],
  );

  const handleLockedClick = useCallback(() => {
    track("try_locked_tile_clicked");
    track("try_signup_clicked", { intent: "unlock" });
    openAuthModal("unlock");
  }, [openAuthModal]);

  // Unlock CTA — fired by locked tile clicks AND the offer card.
  // The batch row is created by finalize-batch when generation finishes;
  // before that the Stripe checkout would have nothing to load, so we
  // no-op until `batchPersisted` flips. The unlock button in the
  // StudioDevelopFrame is gated on the same signal.
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const handleUnlockClick = useCallback(() => {
    track("try_unlock_clicked");
    if (unlockSubmitting) return;
    if (!batchPersisted) return;
    setUnlockSubmitting(true);
    window.location.href = `/api/stripe/unlock-checkout?batchToken=${batchToken}`;
  }, [unlockSubmitting, batchToken, batchPersisted]);

  // Called by OtpAuthFlow once verifyOtp resolves with a session. We
  // attach the anonymous batch to the now-authenticated user so the
  // post-payment unlock page (and library) can find it by user_id.
  // Errors from attach-batch are swallowed — the visual unlock should
  // still proceed; the batch lookup falls back to token-based access.
  // Attach is only meaningful after finalize-batch persists the row.
  const handleClaimSuccess = useCallback(async () => {
    track("try_studio_claimed");
    if (batchPersisted) {
      try {
        await fetch("/api/try/attach-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: batchToken }),
        });
      } catch {}
    }
    setClaimed(true);
  }, [batchToken, batchPersisted]);

  // Originally pushed to /app/library, which threw the user out of the
  // generations page they just signed up *from*. Now we mirror the
  // inline-claim flow: attach the batch, flip `claimed`, refresh server
  // state, and close the modal. The page stays put and the tiles
  // promote to their authed states (HD downloads, no watermark on the
  // free hero, etc.).
  const handleAuthSuccess = useCallback(async () => {
    await handleClaimSuccess();
    setAuthModal((s) => ({ ...s, open: false }));
    router.refresh();
  }, [handleClaimSuccess, router]);

  return (
    <div className={`relative ${developDone && isAuthed ? "pb-40 md:pb-44" : ""}`}>
      <div className="mb-10 flex flex-col items-start justify-between gap-4 md:mb-14 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Developing · N°03
          </p>
          <h1 className="mt-5 font-serif text-[clamp(2.5rem,5.5vw,4rem)] leading-[1.04] tracking-[-0.02em] text-ink md:mt-6">
            In the{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              studio
            </em>
            .
          </h1>
        </div>
      </div>

      {isAuthed ? (
        <AuthedDevelopLayout
          photo={photo}
          picked={picked}
          sceneById={sceneById}
          effectiveFile={effectiveFile}
          generationResults={generationResults}
          setGenerationResults={setGenerationResults}
          setServerSourceUrl={setServerSourceUrl}
          displayResults={displayResults}
          variant={variant}
          handleDownloadClick={handleDownloadClick}
          handleLockedClick={handleLockedClick}
          castingRace={batchCastingRace}
        />
      ) : (
        <UnauthEditorialStage
          photo={photo}
          picked={picked}
          sceneById={sceneById}
          effectiveFile={effectiveFile}
          generationResults={generationResults}
          setGenerationResults={setGenerationResults}
          setServerSourceUrl={setServerSourceUrl}
          variant={variant}
          handleDownloadClick={handleDownloadClick}
          handleUnlockClick={handleUnlockClick}
          unlockSubmitting={unlockSubmitting}
          claimed={claimed}
          batchReady={batchPersisted}
          onClaimSuccess={handleClaimSuccess}
          castingRace={batchCastingRace}
        />
      )}

      {developDone && isAuthed ? (
        <SavedBar status={saveStatus} runId={savedRunId} onReset={onReset} />
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

// The cinematic unauth reveal: 3 generations laid out as a hero-with-
// peeks stage that bleeds past the content column, watermarked but not
// blurred. A single inline CTA does all the conversion work; there is
// no offer card, no bottom strip, no source thumbnail competing for
// attention. The page reads as an editorial photo spread.
function UnauthEditorialStage({
  photo,
  picked,
  sceneById,
  effectiveFile,
  generationResults,
  setGenerationResults,
  setServerSourceUrl,
  variant,
  handleDownloadClick,
  handleUnlockClick,
  unlockSubmitting,
  claimed,
  batchReady,
  onClaimSuccess,
  castingRace,
}: {
  photo: Photo | null;
  picked: string[];
  sceneById: Record<string, Scene>;
  effectiveFile: File | null;
  generationResults: TileResult[];
  setGenerationResults: React.Dispatch<React.SetStateAction<TileResult[]>>;
  setServerSourceUrl: (url: string | null) => void;
  variant: DevelopGridVariant;
  handleDownloadClick: (slug: string) => void;
  handleUnlockClick: () => void;
  unlockSubmitting: boolean;
  claimed: boolean;
  batchReady: boolean;
  onClaimSuccess: (args: { email: string; userId: string }) => void | Promise<void>;
  castingRace: string;
}) {
  const anyPending = generationResults.some((r) => r.status === "pending");
  const allSucceeded =
    !anyPending &&
    generationResults.length > 0 &&
    generationResults.every((r) => r.status === "succeeded");

  const sceneNames = picked
    .map((slug) => sceneById[slug]?.name)
    .filter((n): n is string => Boolean(n));

  // Click-to-enlarge lightbox for resolved tiles. Same component used by
  // /try/b/[token] so the preview interaction is identical across the
  // live and persisted flows.
  const [lightboxSlug, setLightboxSlug] = useState<string | null>(null);
  const lightboxTile =
    lightboxSlug && generationResults.find((r) => r.sceneSlug === lightboxSlug);

  // The claim + upsell rail only appears once the batch is persisted
  // (so we have a token to attach on OTP success). Before that, even
  // if the images are visible, the email entry would authenticate
  // without an attached batch.
  return (
    <>
      {anyPending && photo && effectiveFile && sceneById[picked[0]] ? (
        // Streaming half of the lifecycle: ProgressScreen drives the
        // generation hook and renders the "In the studio." frame with the
        // default StudioGrid (dark editorial cards with rotating status
        // text). Once every tile resolves we hand off to the persisted
        // composition below — the shell stays the same, only the tile
        // system swaps so we get watermark + download CTAs.
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
          castingRace={castingRace}
          onSourceUrl={(url) => setServerSourceUrl(url)}
          onUnlockClick={handleUnlockClick}
          studio={{
            sourceUrl: photo.url,
            sourceName: photo.name,
            sceneNames,
          }}
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
                    focalPoint: hit.focalPoint ?? r.focalPoint ?? null,
                    faceBox: hit.faceBox ?? r.faceBox ?? null,
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
      ) : generationResults.length === 1 && generationResults[0] ? (
        // Persisted single-image batch — dedicated showcase composition.
        // No upsell sidebar; one cinematic hero dominates with editorial
        // overlays. Matches /try/b/[token] for 1-image batches so a
        // refresh mid-state stays consistent.
        <SingleImageHeroLayout
          tile={generationResults[0]}
          sourceUrl={photo?.url}
          sceneNames={sceneNames}
          unlocked={claimed}
          createdAt={new Date().toISOString()}
          onDownloadClick={handleDownloadClick}
          onPreviewClick={setLightboxSlug}
        />
      ) : (
        // Persisted half of the lifecycle (and the source-File hydration
        // fallback). The adaptive monetization layout takes over once
        // every tile lands — count-aware composition for 2- and 3-tile
        // batches with hero + locked previews + the wine premium upsell.
        // Visually matches /try/b/[token] so a refresh mid-state doesn't
        // change the page.
        <AdaptiveStudioLayout
          results={generationResults}
          sourceUrl={photo?.url}
          sceneNames={sceneNames}
          claimed={claimed}
          paid={false}
          unlockReady={batchReady}
          unlockSubmitting={unlockSubmitting}
          onDownloadClick={handleDownloadClick}
          onUnlockClick={handleUnlockClick}
          onPreviewClick={setLightboxSlug}
        />
      )}

      {allSucceeded && batchReady ? (
        <>
          <EditorialClaimRail
            generations={generationResults}
            claimed={claimed}
            onClaimSuccess={onClaimSuccess}
            onUnlock={handleUnlockClick}
            unlockSubmitting={unlockSubmitting}
          />
          <TrustRow />
        </>
      ) : null}

      <Lightbox
        image={
          lightboxTile && lightboxTile.outputUrl
            ? {
                sceneName: lightboxTile.sceneName,
                outputUrl: lightboxTile.outputUrl,
                rawUrl: lightboxTile.rawUrl ?? null,
                isFreePreview: lightboxTile.isFreePreview,
              }
            : null
        }
        claimed={claimed}
        onClose={() => setLightboxSlug(null)}
        onDownload={() => {
          if (!lightboxTile) return;
          setLightboxSlug(null);
          handleDownloadClick(lightboxTile.sceneSlug);
        }}
        onUnlock={() => {
          setLightboxSlug(null);
          handleUnlockClick();
        }}
      />
    </>
  );
}

// Authed develop layout. While generation is pending, the StudioDevelopFrame
// (with left rail / responsive grid / right offer rail / bottom strip) renders
// inside the standard Container. Once results land we drop back to the simple
// 2-column layout (source thumb + DevelopGrid) so the user can download HD
// images and the SavedBar can mount.
function AuthedDevelopLayout({
  photo,
  picked,
  sceneById,
  effectiveFile,
  generationResults,
  setGenerationResults,
  setServerSourceUrl,
  displayResults,
  variant,
  handleDownloadClick,
  handleLockedClick,
  castingRace,
}: {
  photo: Photo | null;
  picked: string[];
  sceneById: Record<string, Scene>;
  effectiveFile: File | null;
  generationResults: TileResult[];
  setGenerationResults: React.Dispatch<React.SetStateAction<TileResult[]>>;
  setServerSourceUrl: (url: string | null) => void;
  displayResults: TileResult[];
  variant: DevelopGridVariant;
  handleDownloadClick: (slug: string) => void;
  handleLockedClick: () => void;
  castingRace: string;
}) {
  const anyPending = generationResults.some((r) => r.status === "pending");
  const sceneNames = picked
    .map((slug) => sceneById[slug]?.name)
    .filter((n): n is string => Boolean(n));

  if (anyPending && photo && effectiveFile && sceneById[picked[0]]) {
    return (
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
        castingRace={castingRace}
        onSourceUrl={(url) => setServerSourceUrl(url)}
        onDownloadClick={handleDownloadClick}
        studio={{
          sourceUrl: photo.url,
          sourceName: photo.name,
          sceneNames,
        }}
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
                  focalPoint: hit.focalPoint ?? r.focalPoint ?? null,
                  faceBox: hit.faceBox ?? r.faceBox ?? null,
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
    );
  }

  return (
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
        <DevelopGrid
          results={displayResults}
          variant={variant}
          sourceUrl={photo?.url}
          onDownloadClick={handleDownloadClick}
          onLockedClick={handleLockedClick}
        />
      </div>
    </div>
  );
}

