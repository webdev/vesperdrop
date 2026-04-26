/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { SCENES, type Scene } from "@/components/marketing/discover";
import { WizardSteps, type StepId } from "./wizard-steps";
import { ExampleInput } from "./example-input";
import { DevelopGrid } from "./develop-grid";

type Direction = "left" | "right";
const EXIT_MS = 280;
const SWIPE_THRESHOLD = 110;

const SCENE_BY_SLUG: Record<string, Scene> = SCENES.reduce(
  (acc, s) => ({ ...acc, [s.slug]: s }),
  {} as Record<string, Scene>,
);
const SCENE_INDEX: Record<string, number> = SCENES.reduce(
  (acc, s, i) => ({ ...acc, [s.slug]: i }),
  {} as Record<string, number>,
);

const SAMPLE_SRC = "/marketing/before-after/cami_before.png";
const SAMPLE_NAME = "CAM-BRN-S_SAMPLE.JPG";

type Photo = { url: string; name: string; isObjectUrl: boolean };

type ScenePreset = {
  id: string;
  name: string;
  caption: string;
  src: string;
};

const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "studio_athletic",
    name: "Studio Athletic",
    caption: "STUDIO · SOFT STROBE",
    src: "/marketing/styles/studio_athletic.jpg",
  },
  {
    id: "leather_noir",
    name: "Leather Noir",
    caption: "INTERIOR · LOW KEY",
    src: "/marketing/styles/leather_noir.jpg",
  },
  {
    id: "graffiti_alley",
    name: "Graffiti Alley",
    caption: "ALLEY · BOUNCED LIGHT",
    src: "/marketing/styles/graffiti_alley.jpg",
  },
];

export function TryFlow() {
  const [step, setStep] = useState<StepId>("upload");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [pickedScenes, setPickedScenes] = useState<string[]>([]);
  const [skipDevelop, setSkipDevelop] = useState(false);
  const [developDone, setDevelopDone] = useState(false);

  const allSlugs = useMemo(() => SCENES.map((s) => s.slug), []);
  const [deck, setDeck] = useState<string[]>(allSlugs);
  const [liked, setLiked] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [history, setHistory] = useState<{ slug: string; dir: Direction }[]>(
    [],
  );
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exiting, setExiting] = useState<{
    slug: string;
    dir: Direction;
  } | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) return;
      if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
      const url = URL.createObjectURL(file);
      setPhoto({ url, name: file.name, isObjectUrl: true });
      setStep("style");
    },
    [photo],
  );

  const useSample = useCallback(() => {
    if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
    setPhoto({ url: SAMPLE_SRC, name: SAMPLE_NAME, isObjectUrl: false });
    setStep("style");
  }, [photo]);

  const resetPhoto = useCallback(() => {
    if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
    setPhoto(null);
  }, [photo]);

  const resetAll = useCallback(() => {
    if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setPickedScenes([]);
    setDeck(allSlugs);
    setLiked([]);
    setSkipped([]);
    setHistory([]);
    setSkipDevelop(false);
    setDevelopDone(false);
    setStep("upload");
  }, [allSlugs, photo]);

  const togglePickedScene = useCallback((id: string) => {
    setPickedScenes((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  }, []);

  const topSlug = deck[0];
  const next1Slug = deck[1];
  const next2Slug = deck[2];

  const decide = useCallback(
    (dir: Direction) => {
      if (!topSlug || exiting) return;
      const slug = topSlug;
      setExiting({ slug, dir });
      setHistory((h) => [...h, { slug, dir }]);
      window.setTimeout(() => {
        setDeck((d) => d.slice(1));
        if (dir === "right") setLiked((l) => [...l, slug]);
        else setSkipped((s) => [...s, slug]);
        setExiting(null);
        setDrag({ x: 0, y: 0, active: false });
      }, EXIT_MS);
    },
    [topSlug, exiting],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setDeck((d) => [last.slug, ...d]);
      if (last.dir === "right") setLiked((l) => l.filter((x) => x !== last.slug));
      else setSkipped((s) => s.filter((x) => x !== last.slug));
      return h.slice(0, -1);
    });
  }, []);

  const resetDeck = useCallback(() => {
    setDeck(allSlugs);
    setLiked([]);
    setSkipped([]);
    setHistory([]);
  }, [allSlugs]);

  useEffect(() => {
    if (step !== "style") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        decide("right");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        decide("left");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, decide, undo]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (exiting || !topSlug) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.active) return;
    setDrag({
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
      active: true,
    });
  }
  function onPointerUp() {
    if (!drag.active) return;
    if (drag.x > SWIPE_THRESHOLD) decide("right");
    else if (drag.x < -SWIPE_THRESHOLD) decide("left");
    else setDrag({ x: 0, y: 0, active: false });
  }

  const totalDecided = liked.length + skipped.length;
  const deckEmpty = deck.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)]">
      <header className="border-b border-[var(--color-line)] bg-[var(--color-paper)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-12">
          <Link
            href="/"
            className="font-serif text-2xl font-light italic tracking-tight text-[var(--color-ink)] hover:text-[var(--color-ember)]"
          >
            ← Darkroom
          </Link>
          <div className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-[var(--color-ink)] underline-offset-4 hover:text-[var(--color-ember)] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <WizardSteps current={step} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 md:px-12 md:py-16">
        {step === "upload" ? (
          <UploadStep
            photo={photo}
            fileInputRef={fileInputRef}
            onFiles={handleFiles}
            onUseSample={useSample}
          />
        ) : null}

        {step === "style" ? (
          <StyleStep
            topSlug={topSlug}
            next1Slug={next1Slug}
            next2Slug={next2Slug}
            deckEmpty={deckEmpty}
            liked={liked}
            skipped={skipped}
            totalDecided={totalDecided}
            history={history}
            drag={drag}
            exiting={exiting}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDecide={decide}
            onUndo={undo}
            onResetDeck={resetDeck}
            onBack={() => setStep("upload")}
            onContinue={() => setStep("scenes")}
          />
        ) : null}

        {step === "scenes" ? (
          <ScenesStep
            picked={pickedScenes}
            onToggle={togglePickedScene}
            onBack={() => setStep("style")}
            onContinue={() => {
              setSkipDevelop(false);
              setDevelopDone(false);
              setStep("develop");
            }}
          />
        ) : null}

        {step === "develop" ? (
          <DevelopStep
            photo={photo}
            liked={liked}
            picked={pickedScenes}
            skip={skipDevelop}
            developDone={developDone}
            onSkip={() => setSkipDevelop(true)}
            onComplete={() => setDevelopDone(true)}
            onReset={resetAll}
          />
        ) : null}
      </main>
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
  onFiles: (files: FileList | null) => void;
  onUseSample: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.2fr_1fr] md:gap-16">
      <div>
        <p className="mb-5 font-mono text-[10px] tracking-[0.2em] text-[var(--color-ink-3)] uppercase">
          NEW BATCH · N°01
        </p>
        <h1 className="font-serif text-[clamp(48px,7vw,80px)] font-light leading-[0.98] tracking-tight text-[var(--color-ink)]">
          Drop your <span className="italic">product</span>.
        </h1>
        <p className="mt-5 max-w-lg font-serif text-lg font-light leading-snug text-[var(--color-ink-2)] md:text-xl">
          Any flatlay works — on the floor, on a rug, on your desk. Your Amazon
          main image is perfect.
        </p>

        {photo ? (
          <p className="mt-5 font-mono text-[10px] tracking-[0.16em] text-[var(--color-ink-3)] uppercase">
            ON FILE · {photo.name} · DROP A DIFFERENT ONE TO REPLACE
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
  onFiles: (files: FileList | null) => void;
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
          onFiles(e.dataTransfer.files);
        }}
        className="block w-full cursor-pointer border-[1.5px] border-dashed bg-[var(--color-cream)] px-8 py-14 text-center transition-colors"
        style={{
          borderColor: dragging
            ? "var(--color-ember)"
            : "var(--color-ink-3)",
          background: dragging
            ? "rgba(194,69,28,0.04)"
            : "var(--color-cream)",
        }}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-paper-2)]">
          <span className="font-serif text-2xl italic text-[var(--color-ink-2)]">
            ↑
          </span>
        </div>
        <div className="text-base text-[var(--color-ink)]">
          Drag a product photo here
        </div>
        <div className="mt-1.5 text-sm text-[var(--color-ink-3)]">
          or{" "}
          <span className="text-[var(--color-ember)] underline underline-offset-4">
            browse files
          </span>{" "}
          · PNG, JPG up to 40MB
        </div>
        <div className="mt-6 border-t border-[var(--color-line)] pt-5 font-mono text-[10px] tracking-[0.16em] text-[var(--color-ink-4)] uppercase">
          NO ACCOUNT · NO CARD · STAYS IN YOUR BROWSER
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <div className="mt-4 text-sm text-[var(--color-ink-3)]">
        Don&apos;t have one handy?{" "}
        <button
          type="button"
          onClick={onUseSample}
          className="text-[var(--color-ember)] underline underline-offset-4 hover:text-[var(--color-ink)]"
        >
          Use a sample product →
        </button>
      </div>
    </>
  );
}

type StyleStepProps = {
  topSlug: string | undefined;
  next1Slug: string | undefined;
  next2Slug: string | undefined;
  deckEmpty: boolean;
  liked: string[];
  skipped: string[];
  totalDecided: number;
  history: { slug: string; dir: Direction }[];
  drag: { x: number; y: number; active: boolean };
  exiting: { slug: string; dir: Direction } | null;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onDecide: (dir: Direction) => void;
  onUndo: () => void;
  onResetDeck: () => void;
  onBack: () => void;
  onContinue: () => void;
};

function StyleStep(props: StyleStepProps) {
  const {
    topSlug,
    next1Slug,
    next2Slug,
    deckEmpty,
    liked,
    skipped,
    totalDecided,
    history,
    drag,
    exiting,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDecide,
    onUndo,
    onResetDeck,
    onBack,
    onContinue,
  } = props;

  return (
    <div>
      <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-[var(--color-ink-3)] uppercase">
            REFERENCE STYLE · N°02
          </p>
          <h1 className="font-serif text-[clamp(40px,6vw,72px)] font-light leading-[0.98] tracking-tight text-[var(--color-ink)]">
            Train your <span className="italic">eye</span>.
          </h1>
          <p className="mt-3 max-w-xl font-serif text-base font-light leading-snug text-[var(--color-ink-2)] md:text-lg">
            Swipe the looks you&apos;d buy. Skip what doesn&apos;t speak. We
            blend lighting, palette, and mood into your batch.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="self-start font-mono text-[11px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase underline-offset-4 hover:text-[var(--color-ember)] hover:underline md:self-end"
        >
          ← Back to upload
        </button>
      </div>

      <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[1fr_440px] md:gap-16">
        <div className="order-2 md:order-1">
          <div className="mb-6 flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase">
              YOUR DECK
            </p>
            <p className="font-serif text-2xl italic text-[var(--color-ink)]">
              {totalDecided}{" "}
              <span className="text-[var(--color-ink-3)]">
                / {SCENES.length}
              </span>
            </p>
          </div>
          <div className="mb-7 flex gap-1">
            {SCENES.map((_, i) => (
              <div
                key={i}
                className={`h-[2px] flex-1 transition-colors ${
                  i < totalDecided
                    ? "bg-[var(--color-ember)]"
                    : "bg-[var(--color-line)]"
                }`}
              />
            ))}
          </div>
          <div className="mb-7 flex items-center gap-6 font-mono text-[11px] tracking-[0.14em] uppercase">
            <span className="text-[var(--color-ember)]">
              ♥ {liked.length} liked
            </span>
            <span className="text-[var(--color-ink-3)]">
              ✕ {skipped.length} skipped
            </span>
          </div>

          {deckEmpty ? (
            <p className="mb-6 max-w-md font-serif text-lg font-light leading-snug text-[var(--color-ink-2)]">
              {liked.length > 0
                ? `${liked.length} look${liked.length === 1 ? "" : "s"} saved. Continue to scenes →`
                : "You skipped everything. Reset and pick at least one."}
            </p>
          ) : (
            <p className="mb-6 max-w-md font-serif text-lg font-light leading-snug text-[var(--color-ink-2)]">
              Drag the top card. Or use{" "}
              <kbd className="rounded border border-[var(--color-line)] bg-[var(--color-paper-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-ink)]">
                ←
              </kbd>{" "}
              /{" "}
              <kbd className="rounded border border-[var(--color-line)] bg-[var(--color-paper-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-ink)]">
                →
              </kbd>
              .
            </p>
          )}

          <div className="flex items-center gap-3">
            {!deckEmpty ? (
              <>
                <button
                  type="button"
                  onClick={() => onDecide("left")}
                  disabled={!topSlug || !!exiting}
                  className="inline-flex h-12 w-12 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-paper)] font-mono text-base text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-[var(--color-cream)] disabled:opacity-40"
                  aria-label="Skip"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={history.length === 0}
                  className="inline-flex h-12 w-12 items-center justify-center border border-[var(--color-line)] bg-[var(--color-paper)] font-mono text-xs text-[var(--color-ink-3)] transition-colors hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-30"
                  aria-label="Undo"
                >
                  ↺
                </button>
                <button
                  type="button"
                  onClick={() => onDecide("right")}
                  disabled={!topSlug || !!exiting}
                  className="inline-flex h-12 w-12 items-center justify-center border border-[var(--color-ember)] bg-[var(--color-ember)] font-mono text-base text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  aria-label="Save"
                >
                  ♥
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onResetDeck}
                className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase underline-offset-4 hover:text-[var(--color-ink)] hover:underline"
              >
                ↺ Start over
              </button>
            )}
          </div>

          <div className="mt-10 flex items-center gap-5">
            <button
              type="button"
              disabled={liked.length === 0}
              onClick={onContinue}
              className="inline-flex items-center rounded-full bg-[var(--color-ember)] px-6 py-3 text-sm font-medium text-[var(--color-cream)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              Continue → Pick scenes →
            </button>
            {liked.length === 0 ? (
              <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase">
                Like at least one look
              </span>
            ) : null}
          </div>
        </div>

        <div className="order-1 mx-auto w-full max-w-[420px] md:order-2">
          <div className="relative aspect-[4/5] touch-none select-none">
            {[next2Slug, next1Slug, topSlug]
              .filter((s): s is string => Boolean(s))
              .map((slug, idx, arr) => {
                const card = SCENE_BY_SLUG[slug];
                if (!card) return null;
                const isTop = idx === arr.length - 1;
                const offset = arr.length - 1 - idx;
                const ty = offset * 14;
                const scale = 1 - offset * 0.04;

                let transform: string;
                let transition: string;
                if (isTop && exiting && exiting.slug === slug) {
                  const dx = exiting.dir === "right" ? 800 : -800;
                  const dr = exiting.dir === "right" ? 28 : -28;
                  transform = `translate(${dx}px, -40px) rotate(${dr}deg)`;
                  transition = `transform ${EXIT_MS}ms cubic-bezier(0.4,0,0.6,1), opacity ${EXIT_MS}ms`;
                } else if (isTop) {
                  const dragRot = drag.x * 0.06;
                  transform = `translate(${drag.x}px, ${drag.y * 0.4}px) rotate(${dragRot}deg)`;
                  transition = drag.active
                    ? "none"
                    : "transform 0.18s cubic-bezier(0.2,0.8,0.2,1)";
                } else {
                  transform = `translateY(${ty}px) scale(${scale})`;
                  transition = "transform 0.28s cubic-bezier(0.2,0.8,0.2,1)";
                }

                const opacity =
                  isTop && exiting && exiting.slug === slug ? 0 : 1;

                return (
                  <div
                    key={slug}
                    onPointerDown={isTop ? onPointerDown : undefined}
                    onPointerMove={isTop ? onPointerMove : undefined}
                    onPointerUp={isTop ? onPointerUp : undefined}
                    onPointerCancel={isTop ? onPointerUp : undefined}
                    className={`absolute inset-0 overflow-hidden border border-[var(--color-line)] bg-[var(--color-cream)] ${
                      isTop
                        ? "shadow-[0_18px_50px_rgba(27,25,21,0.22)]"
                        : "shadow-[0_8px_22px_rgba(27,25,21,0.10)]"
                    } ${isTop ? (drag.active ? "cursor-grabbing" : "cursor-grab") : "pointer-events-none"}`}
                    style={{ transform, transition, opacity }}
                  >
                    <img
                      src={`/marketing/styles/${card.slug}.jpg`}
                      alt={card.name}
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/75" />
                    <div className="absolute top-4 left-4 bg-black/55 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--color-cream)] backdrop-blur-sm">
                      REF_
                      {String(SCENE_INDEX[card.slug] + 1).padStart(3, "0")}
                      {" · "}
                      {card.category}
                    </div>
                    {isTop ? (
                      <>
                        <div
                          className="pointer-events-none absolute top-8 left-6 rotate-[-12deg] border-[3px] border-[var(--color-ember)] bg-[var(--color-cream)]/85 px-3.5 py-2 font-mono text-xl font-bold tracking-[0.18em] text-[var(--color-ember)]"
                          style={{
                            opacity:
                              drag.x > 30
                                ? Math.min(1, drag.x / SWIPE_THRESHOLD)
                                : 0,
                            transition: drag.active
                              ? "none"
                              : "opacity 0.15s",
                          }}
                        >
                          LIKE
                        </div>
                        <div
                          className="pointer-events-none absolute top-8 right-6 rotate-[12deg] border-[3px] border-[var(--color-ink)] bg-[var(--color-cream)]/85 px-3.5 py-2 font-mono text-xl font-bold tracking-[0.18em] text-[var(--color-ink)]"
                          style={{
                            opacity:
                              drag.x < -30
                                ? Math.min(1, -drag.x / SWIPE_THRESHOLD)
                                : 0,
                            transition: drag.active
                              ? "none"
                              : "opacity 0.15s",
                          }}
                        >
                          NOPE
                        </div>
                      </>
                    ) : null}
                    <div className="pointer-events-none absolute right-0 bottom-0 left-0 px-5 pt-12 pb-5 text-[var(--color-cream)]">
                      <h3 className="font-serif text-3xl font-light italic">
                        {card.name}
                      </h3>
                      <p className="mt-2 font-mono text-[10px] tracking-[0.14em] opacity-85">
                        {card.mood}
                      </p>
                      <div className="mt-3 flex h-1.5">
                        {card.palette.map((c, i) => (
                          <div
                            key={i}
                            className="flex-1"
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="mt-6 text-center font-mono text-[10px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase">
            {deckEmpty
              ? "DECK COMPLETE"
              : `${String(totalDecided + 1).padStart(2, "0")} / ${String(SCENES.length).padStart(2, "0")} · SCENE DECK`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ScenesStep({
  picked,
  onToggle,
  onBack,
  onContinue,
}: {
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
          <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-[var(--color-ink-3)] uppercase">
            SCENES · N°03
          </p>
          <h1 className="font-serif text-[clamp(40px,6vw,72px)] font-light leading-[0.98] tracking-tight text-[var(--color-ink)]">
            Pick your <span className="italic">scenes</span>.
          </h1>
          <p className="mt-3 max-w-xl font-serif text-base font-light leading-snug text-[var(--color-ink-2)] md:text-lg">
            Choose the surroundings. We&apos;ll spread your six shots across
            them.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="self-start font-mono text-[11px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase underline-offset-4 hover:text-[var(--color-ember)] hover:underline md:self-end"
        >
          ← Back to style
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {SCENE_PRESETS.map((s) => {
          const on = picked.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggle(s.id)}
              onKeyDown={(e) => onCardKey(e, s.id)}
              className="group block text-left"
              aria-pressed={on}
            >
              <div
                className="relative aspect-[4/5] overflow-hidden bg-[var(--color-cream)] transition-all"
                style={{
                  outline: on
                    ? "3px solid var(--color-ember)"
                    : "1px solid var(--color-line)",
                  outlineOffset: on ? -3 : -1,
                }}
              >
                <img
                  src={s.src}
                  alt={s.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/55" />
                {on ? (
                  <div className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-ember)] font-mono text-xs font-bold text-[var(--color-cream)]">
                    ✓
                  </div>
                ) : null}
                <div className="absolute right-0 bottom-0 left-0 px-4 pt-10 pb-4 text-[var(--color-cream)]">
                  <h3 className="font-serif text-2xl font-light italic">
                    {s.name}
                  </h3>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.14em] opacity-85 uppercase">
                    {s.caption}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-[var(--color-line)] pt-6">
        <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase">
          {picked.length} scene{picked.length === 1 ? "" : "s"} picked
        </p>
        <button
          type="button"
          disabled={picked.length === 0}
          onClick={onContinue}
          className="inline-flex items-center rounded-full bg-[var(--color-ember)] px-6 py-3 text-sm font-medium text-[var(--color-cream)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          Develop my batch →
        </button>
      </div>
    </div>
  );
}

function DevelopStep({
  photo,
  liked,
  picked,
  skip,
  developDone,
  onSkip,
  onComplete,
  onReset,
}: {
  photo: Photo | null;
  liked: string[];
  picked: string[];
  skip: boolean;
  developDone: boolean;
  onSkip: () => void;
  onComplete: () => void;
  onReset: () => void;
}) {
  return (
    <div className="relative">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-[var(--color-ink-3)] uppercase">
            DEVELOPING · N°04
          </p>
          <h1 className="font-serif text-[clamp(40px,6vw,72px)] font-light leading-[0.98] tracking-tight text-[var(--color-ink)]">
            In the <span className="italic">darkroom</span>.
          </h1>
        </div>
        {!developDone ? (
          <button
            type="button"
            onClick={onSkip}
            className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase underline-offset-4 hover:text-[var(--color-ember)] hover:underline"
          >
            Skip animation →
          </button>
        ) : null}
      </div>

      <div className="mb-10 grid grid-cols-1 items-start gap-8 md:grid-cols-[260px_1fr] md:gap-12">
        <div>
          <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase">
            Your product
          </p>
          {photo ? (
            <div className="aspect-square overflow-hidden border border-[var(--color-line)] bg-[var(--color-cream)]">
              <img
                src={photo.url}
                alt={photo.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center border border-[var(--color-line)] bg-[var(--color-paper-2)] font-mono text-[10px] text-[var(--color-ink-3)] uppercase">
              No product
            </div>
          )}

          <div className="mt-4">
            <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase">
              Style · {liked.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {liked.map((slug) => (
                <span
                  key={slug}
                  className="border border-[var(--color-line)] bg-[var(--color-cream)] px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-[var(--color-ink-2)] uppercase"
                >
                  {SCENE_BY_SLUG[slug]?.name ?? slug}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase">
              Scenes · {picked.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {picked.map((id) => {
                const sp = SCENE_PRESETS.find((p) => p.id === id);
                return (
                  <span
                    key={id}
                    className="border border-[var(--color-ember)] bg-[var(--color-ember)]/10 px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-[var(--color-ember)] uppercase"
                  >
                    {sp?.name ?? id}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <DevelopGrid skip={skip} onComplete={onComplete} />
        </div>
      </div>

      {developDone ? <SignUpGate onReset={onReset} /> : null}
    </div>
  );
}

function SignUpGate({ onReset }: { onReset: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--color-ink)]/55 px-6 py-10 backdrop-blur-sm">
      <div className="w-full max-w-md border border-[var(--color-line)] bg-[var(--color-paper)] px-8 py-10 text-center shadow-[0_30px_80px_rgba(27,25,21,0.45)]">
        <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-ink-3)] uppercase">
          BATCH READY · N°01
        </p>
        <h2 className="mt-4 font-serif text-4xl font-light leading-tight text-[var(--color-ink)] md:text-5xl">
          Save &amp; download your <span className="italic">batch</span>.
        </h2>
        <p className="mt-4 font-serif text-base font-light text-[var(--color-ink-2)]">
          Create a free account to download these shots and develop your own
          product.
        </p>
        <Link
          href="/sign-up"
          className="mt-7 inline-flex items-center rounded-full bg-[var(--color-ember)] px-7 py-4 text-sm font-medium text-[var(--color-cream)] transition-transform hover:scale-[1.02] hover:bg-[#a83c18]"
        >
          Create your account →
        </Link>
        <div className="mt-5">
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase underline-offset-4 hover:text-[var(--color-ember)] hover:underline"
          >
            ← Try with another product
          </button>
        </div>
        <div className="mt-6 border-t border-[var(--color-line)] pt-5 font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-4)] uppercase">
          FREE · NO CARD · YOUR FIRST BATCH IS ON US
        </div>
      </div>
    </div>
  );
}
