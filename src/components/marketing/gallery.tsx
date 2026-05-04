/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { sceneify } from "@/lib/sceneify/client";
import type { SceneifyPublicPreset } from "@/lib/sceneify/types";

// Editorial 7-scene "complete set" layout. Each card represents a role
// in the deliverable pack — hero / lifestyle / detail / etc. Roles are
// assigned by position so the section reads as a structured set, not a
// random gallery. Presets come from Sceneify's public list; we cap at
// 7 and walk SCENE_ROLES alongside.
const SCENE_ROLES: Array<{ title: string; description: string }> = [
  { title: "Hero", description: "Catalog-ready cover shot for the primary listing." },
  { title: "Lifestyle", description: "On-model context for ads and editorial pages." },
  { title: "Detail", description: "Close-up texture and craftsmanship reveal." },
  { title: "Full length", description: "Full silhouette and proportions in frame." },
  { title: "Ambient", description: "Atmospheric scene that sets the brand mood." },
  { title: "Flat lay", description: "Top-down composition for shop banners." },
  { title: "Back view", description: "Reverse angle to complete the listing." },
];

const VALUE_STRIP = [
  "Delivered in HD",
  "E-commerce-optimized",
  "Consistent styling",
  "Ad & social ready",
] as const;

export async function Gallery() {
  let presets: SceneifyPublicPreset[] = [];
  try {
    presets = await sceneify().listPublicPresets();
  } catch {
    presets = [];
  }
  const ordered = [...presets]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, SCENE_ROLES.length);

  return (
    <section
      id="use-cases"
      className="border-y border-line-soft bg-paper-soft py-20 md:py-24"
    >
      <Container width="marketing">
        {/* Header */}
        <div className="mb-10 flex flex-col items-start justify-between gap-6 md:mb-14 md:flex-row md:items-end">
          <div className="md:max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              The complete set
            </p>
            <h2 className="mt-4 font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-ink">
              7 scenes,{" "}
              <em className="not-italic font-serif italic text-terracotta-dark">
                crafted to convert.
              </em>
            </h2>
            <p className="mt-4 max-w-[520px] text-[15px] leading-[1.55] text-ink-3">
              We transform your product into a full library of scroll-stopping
              lifestyle images.
            </p>
          </div>
          <Link
            href="/discover"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
          >
            Browse the deck <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Subtle divider — opacity 0.6 line, not a hard border */}
        <div
          aria-hidden
          className="mb-10 h-px w-full"
          style={{ background: "rgba(0,0,0,0.06)" }}
        />

        {ordered.length === 0 ? (
          <p className="text-center text-[14px] text-ink-3">
            Scenes loading. Refresh in a moment.
          </p>
        ) : (
          <>
            {/* 4 + 3 editorial grid via 12-col layout: row 1 = 4 × col-span-3,
                row 2 = 3 × col-span-4. Tablet drops to 2 columns; mobile 1. */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-12 md:gap-6">
              {ordered.map((preset, i) => {
                const role = SCENE_ROLES[i] ?? SCENE_ROLES[0]!;
                // Row 1 (i 0..3) = col-span-3; Row 2 (i 4..6) = col-span-4.
                const span = i < 4 ? "md:col-span-3" : "md:col-span-4";
                return (
                  <SceneCard
                    key={preset.slug}
                    index={i + 1}
                    span={span}
                    role={role}
                    preset={preset}
                    delayMs={i * 50}
                  />
                );
              })}
            </div>

            {/* Bottom value strip — soft warm card, 4 short benefits */}
            <div
              className="mt-12 flex flex-col gap-3 rounded-2xl px-5 py-4 md:mt-14 md:flex-row md:items-center md:justify-between md:gap-6 md:px-6 md:py-5"
              style={{
                background: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              {VALUE_STRIP.map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-[12px] text-ink-2"
                >
                  <span aria-hidden className="text-terracotta">
                    ✦
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
      </Container>

      {/* Card load + hover keyframes — global so the animation is
          available without per-component style-jsx scoping. */}
      <style>{`
        @keyframes scene-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

function SceneCard({
  index,
  span,
  role,
  preset,
  delayMs,
}: {
  index: number;
  span: string;
  role: { title: string; description: string };
  preset: SceneifyPublicPreset;
  delayMs: number;
}) {
  return (
    <article
      className={`group ${span} overflow-hidden rounded-2xl bg-surface motion-safe:opacity-0 motion-safe:[animation:scene-card-in_400ms_ease-out_forwards] transition-all duration-200 hover:-translate-y-1`}
      style={{
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
        animationDelay: `${delayMs}ms`,
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-paper-2">
        {preset.heroImageUrl ? (
          <img
            src={preset.heroImageUrl}
            alt={`${role.title} — ${preset.name}`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-[center_25%] transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : null}
        {/* Scene index badge — top-left, dark pill, white number */}
        <span
          className="absolute left-3 top-3 inline-flex items-center justify-center rounded-full font-mono"
          style={{
            background: "rgba(0,0,0,0.75)",
            color: "white",
            fontSize: 11,
            padding: "4px 8px",
            letterSpacing: "0.04em",
          }}
        >
          {String(index).padStart(2, "0")}
        </span>
      </div>
      <div className="p-3.5">
        <p className="text-[14px] font-medium leading-[1.25] text-ink">
          {role.title}
        </p>
        <p className="mt-1 text-[12.5px] leading-[1.45] text-ink-3">
          {role.description}
        </p>
      </div>
    </article>
  );
}
