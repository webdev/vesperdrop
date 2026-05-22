/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { sceneify } from "@/lib/sceneify/client";
import type { SceneifyPublicPreset } from "@/lib/sceneify/types";

// Editorial 7-scene "complete set" — each card represents a role in
// the deliverable pack. Conversion-focused header + use-case pills +
// before/after strip + micro CTA + value/price anchor frame the grid.
// No data, API, or routing changes — backed by Sceneify's public list.
// Cap the grid at 7 scenes to match the "complete set" framing.
const MAX_SCENES = 7;

const USE_CASE_PILLS = [
  "Amazon listing",
  "Shopify PDP",
  "Instagram ads",
  "Email campaigns",
] as const;

const VALUE_STRIP = [
  "Looks like a real photoshoot",
  "Works on your product instantly",
  "Ready for ads, not just mockups",
  "No design skills needed",
] as const;

const SOURCE_FLATLAY = "/marketing/before-after/skirt_before.webp";

export async function Gallery() {
  let presets: SceneifyPublicPreset[] = [];
  try {
    presets = await sceneify().listPublicPresets();
  } catch {
    presets = [];
  }
  const ordered = [...presets]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, MAX_SCENES);

  // First three preset hero URLs used in the before/after strip's overlapping
  // thumb stack. Falls back gracefully if fewer presets are available.
  const thumbUrls = ordered
    .map((p) => p.heroImageUrl)
    .filter((u): u is string => Boolean(u))
    .slice(0, 3);

  return (
    <section
      id="use-cases"
      className="border-y border-line-soft bg-paper-soft py-20 md:py-24"
    >
      <Container width="marketing">
        {/* Header — eyebrow → headline → subtext */}
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            The complete set
          </p>
          <h2 className="mt-2 font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-ink">
            Everything you need to{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              sell your product.
            </em>
          </h2>
          <p className="mt-3 max-w-[520px] text-[15px] leading-[1.55] text-ink-3">
            One photo → a full set for your store, ads, and socials.
          </p>
          {/* Use-case pills — desktop only; add width without converting on mobile */}
          <ul className="mt-6 hidden flex-wrap items-center gap-2 md:flex">
            {USE_CASE_PILLS.map((label) => (
              <li
                key={label}
                className="inline-flex items-center rounded-full"
                style={{
                  height: 28,
                  padding: "0 10px",
                  background: "rgba(255,255,255,0.65)",
                  border: "1px solid rgba(0,0,0,0.05)",
                  fontSize: 12,
                  color: "rgba(0,0,0,0.6)",
                }}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Before → After strip */}
        {thumbUrls.length > 0 ? (
          <div className="mt-10 flex flex-col items-start gap-3 md:mt-12 md:flex-row md:items-center md:gap-6">
            <div className="flex items-center gap-4">
              <span
                className="relative block h-14 w-14 overflow-hidden rounded-[10px] bg-paper-2 shadow-subtle"
                style={{ border: "1px solid rgba(0,0,0,0.05)" }}
              >
                <img
                  src={SOURCE_FLATLAY}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </span>
              <span aria-hidden className="text-[16px] text-ink-4">
                →
              </span>
              <span className="relative inline-flex items-center">
                {thumbUrls.map((url, i) => (
                  <span
                    key={i}
                    className="relative block h-14 w-14 overflow-hidden rounded-[10px] bg-paper-2"
                    style={{
                      marginLeft: i === 0 ? 0 : -10,
                      zIndex: thumbUrls.length - i,
                      border: "1px solid rgba(0,0,0,0.05)",
                      boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
                    }}
                  >
                    <img
                      src={url}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
                    />
                  </span>
                ))}
              </span>
            </div>
            <p className="text-[13px] italic text-ink-3">
              From one photo to a full campaign.
            </p>
          </div>
        ) : null}

        {/* Subtle divider */}
        <div
          aria-hidden
          className="mt-10 mb-10 h-px w-full"
          style={{ background: "rgba(0,0,0,0.06)" }}
        />

        {ordered.length === 0 ? (
          <p className="text-center text-[14px] text-ink-3">
            Scenes loading. Refresh in a moment.
          </p>
        ) : (
          <>
            {/* 4 + 3 editorial grid via 12-col layout. Tablet 2 cols, mobile 1. */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-12 md:gap-6">
              {ordered.map((preset, i) => {
                const span = i < 4 ? "md:col-span-3" : "md:col-span-4";
                return (
                  <SceneCard
                    key={preset.slug}
                    index={i + 1}
                    span={span}
                    preset={preset}
                    delayMs={i * 50}
                  />
                );
              })}
            </div>

            {/* Micro CTA */}
            <div className="mt-12 flex flex-col items-center text-center md:mt-14">
              <p className="font-serif text-[clamp(1.5rem,2.4vw,1.875rem)] leading-[1.15] tracking-[-0.01em] text-ink">
                Ready to generate your full set?
              </p>
              <Link
                href="/try"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-6 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-all duration-200 ease-out hover:-translate-y-px hover:bg-ink-2 hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
                style={{ height: 44 }}
              >
                Generate my set <span aria-hidden>→</span>
              </Link>
              <p className="mt-2 text-[13px] text-ink-3">
                No camera. No studio. No models.
              </p>
            </div>

            {/* Value strip + price anchor — desktop only; redundant on mobile */}
            <div
              aria-hidden
              className="mt-12 hidden h-px w-full md:mt-14 md:block"
              style={{ background: "rgba(0,0,0,0.06)" }}
            />
            <ul className="mt-6 hidden grid-cols-1 gap-3 text-[13px] text-ink-3 sm:grid-cols-2 md:grid md:grid-cols-4 md:gap-6">
              {VALUE_STRIP.map((label) => (
                <li key={label} className="flex items-center gap-2">
                  <span aria-hidden className="text-terracotta">
                    ✦
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            {/* Price anchor */}
            <div className="mt-6 hidden text-center text-[12px] text-ink-4 md:block">
              Typical photoshoot: $300–$2,000 ·{" "}
              <span className="text-ink-3">
                Vesperdrop: starting at $19/mo
              </span>
            </div>
          </>
        )}
      </Container>

      {/* Card load keyframes — global so the animation is available
          without per-component style-jsx scoping. */}
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
  preset,
  delayMs,
}: {
  index: number;
  span: string;
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
            alt={preset.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-[center_25%] transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : null}
        {/* Scene index badge — top-left */}
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
    </article>
  );
}
