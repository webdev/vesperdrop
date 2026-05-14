/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type { TileResult } from "./develop-grid";

// ─── Pricing constants ─────────────────────────────────────────────────
// Centralized so State A, B, C all read from one source and the figures
// can't drift the way "$4 each" vs "$9.99" did in v1. If you change a
// price here, double-check the homepage hero copy still matches.
export const PRICE_PER_SHOT = "$9.99";
// State C bundle (2 locked images): $9.99 — same as a single unlock.
// "2 for the price of 1" framing reads cleaner than the prior "$14.99
// bundle" with $19.98 individually strikethrough math.
export const PRICE_BUNDLE = "$9.99";
// Anchor price for the strikethrough — previous bundle price, not
// "2 × single". Label reads "Was $14.98" rather than "$X individually".
export const PRICE_BUNDLE_WAS = "$14.98";
export const PRICE_BUNDLE_SAVINGS = "$4.99";
export const PRICE_PRO_MONTHLY = "$39/mo";

// Deep wine for the State B/C premium upsell card background. Sampled
// to match the v2 mock — the live terracotta (#c65f3d) is reserved for
// CTAs and is too warm to anchor the upsell card; wine reads as
// "premium tier" without feeling alarming.
const WINE_BG = "#6E1E1B";

// ─── Public component ──────────────────────────────────────────────────

export type AdaptiveStudioLayoutProps = {
  results: TileResult[];
  /** User's uploaded product photo URL — left rail thumbnail. */
  sourceUrl?: string;
  /** Selected scene display names (one chip per name). */
  sceneNames: string[];
  /** Free hero is unlocked (post OTP claim OR paid). */
  claimed: boolean;
  /** Whole batch is paid — every tile unlocks. */
  paid: boolean;
  /** Stripe checkout safe to redirect to (the unlock_batches row exists). */
  unlockReady: boolean;
  /** Per-tile download handler. Hero tile only pre-paid; all tiles post-paid. */
  onDownloadClick: (slug: string) => void;
  /** Trigger paid unlock (Stripe Checkout). State B and State C wire here. */
  onUnlockClick: () => void;
  /** Tile click → lightbox preview. */
  onPreviewClick: (slug: string) => void;
  /** Whether onUnlockClick is mid-flight (Stripe redirect in progress). */
  unlockSubmitting: boolean;
};

export function AdaptiveStudioLayout({
  results,
  sourceUrl,
  sceneNames,
  claimed,
  paid,
  unlockReady,
  onDownloadClick,
  onUnlockClick,
  onPreviewClick,
  unlockSubmitting,
}: AdaptiveStudioLayoutProps) {
  const count = results.length;
  const heroTile = results.find((r) => r.isFreePreview) ?? results[0];
  const lockedTiles = results.filter((r) => r !== heroTile);

  // Universal left column.
  const productCard = (
    <ProductCard sourceUrl={sourceUrl} sceneNames={sceneNames} />
  );

  // Hero is identical across all states — the free tile always reads as
  // editorial / cinematic / no chrome. Pre-claim shows the watermarked
  // outputUrl; post-claim or post-paid, rawUrl. Download CTA gates on the
  // same flag.
  const heroCard = heroTile ? (
    <HeroPreviewCard
      tile={heroTile}
      unlocked={claimed || paid}
      onDownload={() => onDownloadClick(heroTile.sceneSlug)}
      onPreview={() => onPreviewClick(heroTile.sceneSlug)}
    />
  ) : null;

  // STATE A — 1 image — 3 col: product | hero | "generate another"
  if (count === 1) {
    return (
      <section
        data-testid="adaptive-studio-layout"
        data-state="a"
        className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-[220px_minmax(0,1fr)_300px] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)_340px] lg:gap-7"
      >
        {productCard}
        {heroCard}
        <GenerateAnotherCard />
      </section>
    );
  }

  // STATE B — 2 images — 4 col: product | hero | locked | premium upsell
  if (count === 2) {
    return (
      <section
        data-testid="adaptive-studio-layout"
        data-state="b"
        className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-[200px_minmax(0,1.2fr)_minmax(0,1fr)_280px] md:gap-5 lg:grid-cols-[220px_minmax(0,1.2fr)_minmax(0,1fr)_320px] lg:gap-6"
      >
        {productCard}
        {heroCard}
        {lockedTiles[0] ? (
          <LockedPreviewCard
            tile={lockedTiles[0]}
            unlocked={paid}
            onPreview={() => onPreviewClick(lockedTiles[0].sceneSlug)}
            onDownload={() => onDownloadClick(lockedTiles[0].sceneSlug)}
          />
        ) : null}
        {paid ? null : (
          <PremiumUpsellCard
            variant="single"
            disabled={!unlockReady || unlockSubmitting}
            onUnlock={onUnlockClick}
          />
        )}
      </section>
    );
  }

  // STATE C — 3 images — 4 col: product | hero | 2-stack locked | bundle upsell
  return (
    <section
      data-testid="adaptive-studio-layout"
      data-state="c"
      className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-[200px_minmax(0,1.2fr)_minmax(0,0.8fr)_280px] md:gap-5 lg:grid-cols-[220px_minmax(0,1.2fr)_minmax(0,0.9fr)_320px] lg:gap-6"
    >
      {productCard}
      {heroCard}
      <div className="flex flex-col gap-4 md:gap-5">
        {lockedTiles.slice(0, 2).map((t) => (
          <LockedPreviewCard
            key={t.sceneSlug}
            tile={t}
            unlocked={paid}
            compact
            onPreview={() => onPreviewClick(t.sceneSlug)}
            onDownload={() => onDownloadClick(t.sceneSlug)}
          />
        ))}
      </div>
      {paid ? null : (
        <PremiumUpsellCard
          variant="bundle"
          disabled={!unlockReady || unlockSubmitting}
          onUnlock={onUnlockClick}
        />
      )}
    </section>
  );
}

// ─── ProductCard ───────────────────────────────────────────────────────

function ProductCard({
  sourceUrl,
  sceneNames,
}: {
  sourceUrl?: string;
  sceneNames: string[];
}) {
  return (
    <aside
      className="flex flex-col gap-5 rounded-3xl border border-line-soft bg-surface p-5 shadow-subtle md:p-6"
      data-testid="adaptive-product-card"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
        Your product
      </p>
      <div className="aspect-square w-full overflow-hidden rounded-2xl border border-line-soft bg-paper">
        {sourceUrl ? (
          <img
            src={sourceUrl}
            alt="Your product"
            draggable={false}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
            No product
          </div>
        )}
      </div>
      {sceneNames.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sceneNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-full border border-terracotta/30 bg-terracotta-wash px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta-dark"
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

// ─── HeroPreviewCard ───────────────────────────────────────────────────

function HeroPreviewCard({
  tile,
  unlocked,
  onDownload,
  onPreview,
}: {
  tile: TileResult;
  unlocked: boolean;
  onDownload: () => void;
  onPreview: () => void;
}) {
  // Post-claim/post-paid we render rawUrl directly (no watermark); pre-claim
  // we render outputUrl with the diagonal watermark baked in already. The
  // Vesperdrop CSS watermark in DevelopGrid is intentionally NOT reused
  // here — the new layout's hero is the unmistakable "you already got
  // value" surface, so on unauth we still show the watermarked outputUrl
  // but the download CTA routes to claim instead of saving the bytes.
  const imageUrl =
    unlocked && tile.rawUrl ? tile.rawUrl : (tile.outputUrl ?? "");
  // Outer wrapper is a div, not a button — HTML forbids button-in-button
  // and the inner Download CTA needs to be a real <button>. We re-add
  // button semantics via role + keyboard handlers so the entire image
  // is still clickable / focusable / Enter-activatable for lightbox.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview();
        }
      }}
      data-testid="adaptive-hero-card"
      className="group relative block aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-3xl bg-ink text-left shadow-card transition-shadow hover:shadow-card-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      aria-label={`Preview ${tile.sceneName}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={tile.sceneName}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.015]"
          style={{
            objectPosition: tile.focalPoint
              ? `${Math.round(tile.focalPoint.x * 100)}% ${Math.round(tile.focalPoint.y * 100)}%`
              : "center",
          }}
        />
      ) : null}

      {/* Warm bottom gradient anchors the overlay copy + CTA. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(15,12,10,0.0) 35%, rgba(15,12,10,0.30) 70%, rgba(15,12,10,0.72) 100%)",
        }}
      />

      <div className="absolute inset-x-5 bottom-5 flex flex-col items-center gap-3 text-center text-cream md:inset-x-6 md:bottom-6">
        <p className="font-serif text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.08] tracking-[-0.01em]">
          {unlocked ? "Free hero" : "Free hero shot"}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cream/85">
          {unlocked ? "Ready to download" : "No watermark · Ready to download"}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          data-testid="adaptive-hero-download"
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-cream shadow-[0_4px_18px_-6px_rgba(0,0,0,0.45)] transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-terracotta-dark hover:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
        >
          <DownloadIcon />
          Download HD
        </button>
      </div>
    </div>
  );
}

// ─── LockedPreviewCard ─────────────────────────────────────────────────

function LockedPreviewCard({
  tile,
  unlocked,
  compact = false,
  onPreview,
  onDownload,
}: {
  tile: TileResult;
  unlocked: boolean;
  compact?: boolean;
  onPreview: () => void;
  onDownload: () => void;
}) {
  // Post-paid the lock state collapses: render the resolved image with a
  // download badge instead of the blur+lock chrome. Pre-paid we render the
  // outputUrl heavily blurred + dark gradient + a lock badge — desirable,
  // not punishing.
  const imageUrl =
    unlocked && tile.rawUrl ? tile.rawUrl : (tile.outputUrl ?? "");
  const aspect = compact ? "aspect-[4/5]" : "aspect-[4/5]";
  // Same constraint as HeroPreviewCard: outer is a div with role="button"
  // because the unlocked variant nests a real <button> for Download HD,
  // and HTML doesn't allow button-in-button.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview();
        }
      }}
      data-testid="adaptive-locked-card"
      data-locked={!unlocked}
      className={`group relative block w-full cursor-pointer overflow-hidden rounded-3xl bg-ink text-left shadow-card transition-shadow hover:shadow-card-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${aspect}`}
      aria-label={
        unlocked
          ? `Preview ${tile.sceneName}`
          : `Preview ${tile.sceneName} — unlock to see in full`
      }
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={tile.sceneName}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover transition-[filter,transform] duration-700 ease-out"
          style={{
            objectPosition: tile.focalPoint
              ? `${Math.round(tile.focalPoint.x * 100)}% ${Math.round(tile.focalPoint.y * 100)}%`
              : "center",
            filter: unlocked
              ? "none"
              : "blur(22px) saturate(0.92) brightness(0.85)",
            transform: unlocked ? "none" : "scale(1.08)",
          }}
        />
      ) : null}

      {/* Warm cinematic vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 40%, rgba(15,12,10,0.10) 0%, rgba(15,12,10,0.55) 100%)",
        }}
      />

      {/* Subtle diagonal texture lines (only when locked) */}
      {!unlocked ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.6) 0 1px, transparent 1px 14px)",
          }}
        />
      ) : null}

      {unlocked ? (
        <div className="absolute inset-x-4 bottom-4 flex flex-col items-center gap-2 text-center text-cream md:inset-x-5 md:bottom-5">
          <p className="font-serif text-[clamp(1.05rem,1.6vw,1.35rem)] leading-tight tracking-[-0.005em]">
            {tile.sceneName}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            data-testid="adaptive-locked-download"
            className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cream transition-colors hover:bg-terracotta-dark"
          >
            <DownloadIcon />
            Download HD
          </button>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-cream">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/70 backdrop-blur-sm"
          >
            <LockIcon size={18} />
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em]">
            Preview
          </p>
          <p className="font-mono text-[10px] tracking-[0.14em] text-cream/70">
            Locked
          </p>
        </div>
      )}
    </div>
  );
}

// ─── GenerateAnotherCard (State A) ─────────────────────────────────────

function GenerateAnotherCard() {
  // Pre-claim or post-claim, this CTA routes back to /try with the scenes
  // step preselected so the visitor doesn't re-upload. Backend wiring for
  // a true "1 extra generation for $9.99" purchase is out of scope here;
  // pointing at /try?step=scenes preserves the conversion intent until
  // that endpoint lands.
  return (
    <aside
      data-testid="adaptive-generate-another-card"
      className="flex flex-col rounded-3xl border border-terracotta/45 bg-surface p-6 shadow-subtle transition-shadow hover:shadow-card md:p-7"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta-dark">
        Want more looks?
      </p>
      <h3 className="mt-3 font-serif text-[clamp(1.35rem,1.8vw,1.6rem)] leading-[1.1] tracking-[-0.01em] text-ink">
        Generate another scene
      </h3>
      <p className="mt-2 font-sans text-[13.5px] leading-[1.5] text-ink-3">
        Beach · urban · golden hour · indoor
      </p>

      <Link
        href="/try?step=scenes"
        data-testid="adaptive-generate-another-cta"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-cream shadow-[0_4px_18px_-8px_rgba(159,68,42,0.65)] transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-terracotta-dark hover:shadow-[0_10px_28px_-10px_rgba(159,68,42,0.6)]"
      >
        <PlusIcon />
        Generate another · {PRICE_PER_SHOT}
      </Link>

      <p className="mt-4 text-center font-sans text-[12.5px] leading-[1.5] text-ink-3">
        or{" "}
        <Link
          href="/pricing"
          className="text-terracotta-dark underline-offset-4 hover:underline"
        >
          unlimited with Pro · {PRICE_PRO_MONTHLY}
        </Link>
      </p>

      <p className="mt-5 border-t border-line-soft pt-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
        1 free hero shot on signup
      </p>
    </aside>
  );
}

// ─── PremiumUpsellCard (State B + C) ───────────────────────────────────

function PremiumUpsellCard({
  variant,
  disabled,
  onUnlock,
}: {
  variant: "single" | "bundle";
  disabled: boolean;
  onUnlock: () => void;
}) {
  const isBundle = variant === "bundle";
  return (
    <aside
      data-testid="adaptive-premium-upsell-card"
      data-variant={variant}
      className="flex flex-col items-center justify-between rounded-3xl px-6 py-7 text-center text-cream shadow-card md:px-7 md:py-8"
      style={{ backgroundColor: WINE_BG }}
    >
      <div className="flex flex-col items-center gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cream/85">
          Complete the studio
        </p>

        <div className="flex flex-col items-center gap-1">
          {isBundle ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream/55 line-through">
              Was {PRICE_BUNDLE_WAS}
            </p>
          ) : null}
          <p className="font-serif text-[clamp(2.25rem,3.4vw,2.75rem)] leading-none tracking-[-0.01em] text-cream">
            {isBundle ? PRICE_BUNDLE : PRICE_PER_SHOT}
          </p>
          <p className="mt-1 font-sans text-[13.5px] leading-[1.45] text-cream/85">
            {isBundle
              ? `Unlock both HD images · save ${PRICE_BUNDLE_SAVINGS}`
              : "Unlock 1 more HD image"}
          </p>
        </div>

        <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px] leading-[1.45] text-cream/85">
          <CheckRow label="No watermark" />
          <CheckRow label="Commercial license" />
          <CheckRow label="Instant download" />
        </ul>
      </div>

      <div className="mt-6 flex w-full flex-col items-center gap-3">
        <button
          type="button"
          onClick={onUnlock}
          disabled={disabled}
          data-testid="adaptive-premium-unlock-cta"
          className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-terracotta px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-cream transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-terracotta-dark hover:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.6)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {isBundle ? "Unlock both" : "Unlock now"}
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </button>

        <p className="text-center font-sans text-[12.5px] leading-[1.5] text-cream/80">
          or{" "}
          <Link
            href="/pricing"
            className="text-cream underline-offset-4 hover:underline"
          >
            unlimited with Pro · {PRICE_PRO_MONTHLY}
          </Link>
        </p>

        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-cream/55">
          Secure checkout · Stripe
        </p>
      </div>
    </aside>
  );
}

// ─── Tiny presentational helpers ───────────────────────────────────────

function CheckRow({ label }: { label: string }) {
  return (
    <li className="inline-flex items-center gap-2">
      <span aria-hidden className="text-cream/85">
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 6.5l2.5 2.5 4.5-5" />
        </svg>
      </span>
      {label}
    </li>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="M6 9l6 6 6-6" />
      <path d="M5 21h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="1.8" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// ─── StudioCompleteLayout (paid state) ─────────────────────────────────

export type StudioCompleteLayoutProps = {
  results: TileResult[];
  sourceUrl?: string;
  sceneNames: string[];
  /** ISO timestamp of when the batch was minted. Rendered as the
   *  metadata date stamp ("May 13, 2026 · 9:22 PM"). */
  createdAt: string;
  /** Tile click → lightbox preview. The Download-All action lives at
   *  the page header level (next to the status pill), not inside the
   *  gallery, so this component only needs the preview wiring. */
  onPreviewClick: (slug: string) => void;
};

/**
 * Editorial "campaign complete" layout. Rendered post-payment when
 * every tile is unlocked. Asymmetric magazine-spread composition:
 *   - lightweight left column: product thumb + scene chips + metadata
 *     notes + microcopy. No card chrome — just hairlines and labels.
 *   - right gallery: one dominant vertical hero, supporting tiles
 *     stacked beside it with intentional vertical stagger and varied
 *     aspect ratios. Photography dominates; UI weight is minimal.
 *
 * The page-level header carries the status pill + Download All pill,
 * not the gallery — so this component only worries about the spread.
 */
export function StudioCompleteLayout({
  results,
  sourceUrl,
  sceneNames,
  createdAt,
  onPreviewClick,
}: StudioCompleteLayoutProps) {
  const count = results.length;
  const heroTile = results.find((r) => r.isFreePreview) ?? results[0];
  const sideTiles = results.filter((r) => r !== heroTile);
  const formattedDate = formatStudioDate(createdAt);

  return (
    <section
      data-testid="studio-complete-layout"
      data-count={count}
      className="grid grid-cols-1 items-start gap-10 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14"
    >
      <CompleteEditorialRail
        sourceUrl={sourceUrl}
        sceneNames={sceneNames}
        count={count}
        formattedDate={formattedDate}
      />
      <CompleteGallery
        heroTile={heroTile}
        sideTiles={sideTiles}
        totalCount={count}
        onPreview={onPreviewClick}
      />
    </section>
  );
}

function CompleteEditorialRail({
  sourceUrl,
  sceneNames,
  count,
  formattedDate,
}: {
  sourceUrl?: string;
  sceneNames: string[];
  count: number;
  formattedDate: string;
}) {
  // Editorial notes column — no card, no border, no padding box. Just a
  // narrow stack of labels + a small product thumb + chips + metadata.
  // Hairline dividers (border-t border-line-soft) provide gentle rhythm
  // between sections without boxing the content in.
  return (
    <aside
      className="flex flex-col gap-6"
      data-testid="studio-complete-left-rail"
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">
          Your product
        </p>
        <div className="mt-3 aspect-square w-full max-w-[180px] overflow-hidden rounded-xl bg-paper shadow-[0_2px_10px_-4px_rgba(40,30,20,0.18)]">
          {sourceUrl ? (
            <img
              src={sourceUrl}
              alt="Your product"
              draggable={false}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
              No product
            </div>
          )}
        </div>
      </div>

      {sceneNames.length > 0 ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">
            Selected scenes
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {sceneNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-full border border-terracotta/35 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta-dark"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="border-t border-line-soft pt-5">
        <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-dark">
          <span aria-hidden>
            <SparkleIcon />
          </span>
          {count} {count === 1 ? "asset" : "assets"} generated
        </p>
        <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-4">
          {formattedDate}
        </p>
      </div>

      <p className="inline-flex items-center gap-2 border-t border-line-soft pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">
        <LockIcon size={11} /> Secure · Private · Yours
      </p>
    </aside>
  );
}

function CompleteGallery({
  heroTile,
  sideTiles,
  totalCount,
  onPreview,
}: {
  heroTile: TileResult | undefined;
  sideTiles: TileResult[];
  totalCount: number;
  onPreview: (slug: string) => void;
}) {
  // 1 tile → single dominant hero portrait.
  // 2 tiles → hero left, supporting tile right (offset slightly down).
  // 3+ tiles → hero left, two supports stacked right with intentional
  //   vertical stagger + varied aspects so the rhythm reads editorial,
  //   not "CSS grid".
  if (totalCount <= 1) {
    return (
      <div className="flex justify-center">
        {heroTile ? (
          <CompleteTile
            tile={heroTile}
            index={0}
            total={totalCount}
            onPreview={() => onPreview(heroTile.sceneSlug)}
            aspect="hero-tall"
          />
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-6 md:gap-7">
      {heroTile ? (
        <CompleteTile
          tile={heroTile}
          index={0}
          total={totalCount}
          onPreview={() => onPreview(heroTile.sceneSlug)}
          aspect="hero-tall"
        />
      ) : null}
      {/* Right column starts slightly below the hero's top edge for
          editorial stagger. Inner tiles have different aspect ratios so
          the two stacked supports don't read as a 2-cell grid. */}
      <div className="flex flex-col gap-5 sm:gap-6 md:gap-7 sm:pt-10 md:pt-14">
        {sideTiles.slice(0, 1).map((tile, i) => (
          <CompleteTile
            key={tile.sceneSlug}
            tile={tile}
            index={i + 1}
            total={totalCount}
            onPreview={() => onPreview(tile.sceneSlug)}
            aspect="support-wide"
          />
        ))}
        {sideTiles.slice(1, 2).map((tile, i) => (
          <CompleteTile
            key={tile.sceneSlug}
            tile={tile}
            index={i + 2}
            total={totalCount}
            onPreview={() => onPreview(tile.sceneSlug)}
            aspect="support-tall"
          />
        ))}
        {/* Counts > 3: any extras flow as the same support-wide rhythm,
            keeping the editorial cadence rather than collapsing into a
            uniform grid. */}
        {sideTiles.slice(2).map((tile, i) => (
          <CompleteTile
            key={tile.sceneSlug}
            tile={tile}
            index={i + 3}
            total={totalCount}
            onPreview={() => onPreview(tile.sceneSlug)}
            aspect="support-wide"
          />
        ))}
      </div>
    </div>
  );
}

type CompleteTileAspect = "hero-tall" | "support-wide" | "support-tall";

function CompleteTile({
  tile,
  index,
  total,
  onPreview,
  aspect,
}: {
  tile: TileResult;
  index: number;
  total: number;
  onPreview: () => void;
  aspect: CompleteTileAspect;
}) {
  // Paid view: render rawUrl when available (un-watermarked HD). Fall
  // back to outputUrl as a last resort — shouldn't happen in practice
  // since markBatchPaid promotes generations.output_url → raw_url.
  const imageUrl = tile.rawUrl ?? tile.outputUrl ?? "";
  const aspectClass =
    aspect === "hero-tall"
      ? "aspect-[3/4]"
      : aspect === "support-wide"
        ? "aspect-[4/3]"
        : "aspect-[5/4]"; // support-tall — closer to landscape with more height
  return (
    <button
      type="button"
      onClick={onPreview}
      data-testid="studio-complete-tile"
      data-scene-slug={tile.sceneSlug}
      data-aspect={aspect}
      aria-label={`Preview ${tile.sceneName} in HD`}
      className={`group relative block w-full overflow-hidden rounded-3xl bg-ink shadow-[0_8px_28px_-14px_rgba(20,15,10,0.35)] transition-[transform,box-shadow] duration-[600ms] ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-18px_rgba(20,15,10,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${aspectClass}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={tile.sceneName}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-[1200ms] ease-out group-hover:scale-[1.018] group-hover:[filter:contrast(1.04)_saturate(1.04)]"
          style={{
            objectPosition: tile.focalPoint
              ? `${Math.round(tile.focalPoint.x * 100)}% ${Math.round(tile.focalPoint.y * 100)}%`
              : "center",
          }}
        />
      ) : null}

      {/* Top-left: 01 · SCENE NAME — a thin terracotta hairline anchors
          the index, the name reads as the editorial caption. */}
      <div
        className="absolute left-4 top-4 flex flex-col items-start gap-1.5"
        style={{ zIndex: 30 }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cream">
          <span className="text-cream/65">
            {String(index + 1).padStart(2, "0")}
          </span>{" "}
          <span className="ml-1.5">{tile.sceneName}</span>
        </p>
        <span
          aria-hidden
          className="block h-px w-7 bg-terracotta"
        />
      </div>

      {/* Bottom-left HD READY pill */}
      <div
        className="absolute left-4 bottom-4 inline-flex items-center rounded-full border border-cream/35 bg-black/40 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-cream backdrop-blur-sm"
        style={{ zIndex: 30 }}
      >
        HD Ready
      </div>

      {/* Quiet hover hint — "View details ↗" — appears only on hover so
          it never competes with the imagery at rest. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-4 bottom-4 inline-flex items-center gap-1 rounded-full bg-black/55 px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-cream opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100"
        style={{ zIndex: 30 }}
      >
        View details
        <span aria-hidden>↗</span>
      </span>

      <span className="sr-only">
        Asset {index + 1} of {total}
      </span>
    </button>
  );
}

function formatStudioDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const date = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${date} · ${time}`;
  } catch {
    return "";
  }
}

function SparkleIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
    </svg>
  );
}

function RegenerateIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 11a8 8 0 1 0-2.34 5.66" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

// ─── SingleImageHeroLayout ─────────────────────────────────────────────

export type SingleImageHeroLayoutProps = {
  tile: TileResult;
  sourceUrl?: string;
  sceneNames: string[];
  /** Free hero is unlocked (post OTP claim OR paid). Drives whether we
   *  render rawUrl vs outputUrl (which has the watermark baked in) and
   *  whether the bottom-left subcopy reads "No watermark · Ready to
   *  download" or just "Ready to download". */
  unlocked: boolean;
  /** ISO timestamp — rendered as the metadata stamp on the rail. */
  createdAt: string;
  /** Download click. Pre-claim this is wired to the OTP-scroll behavior
   *  in BatchView; post-claim it triggers the blob download. */
  onDownloadClick: (slug: string) => void;
  /** Click image → lightbox flyover. */
  onPreviewClick: (slug: string) => void;
};

/**
 * Single-image showcase for batches with exactly one generation.
 *
 * Composition:
 *   - left: narrow ivory card with product thumb + scene chip + a
 *     single "1 asset generated" line + microcopy. Light, quiet,
 *     secondary — definitely not a dashboard sidebar.
 *   - right: one cinematic wide hero (16:10) with editorial overlays.
 *     Top-left index + scene caption; bottom-left "Free hero shot"
 *     headline + Download HD CTA; bottom-right HD READY pill.
 *
 * The image owns the visual weight. No upsell card, no empty right
 * column, no grid feeling — this is a showcase, not a gallery.
 */
export function SingleImageHeroLayout({
  tile,
  sourceUrl,
  sceneNames,
  unlocked,
  createdAt,
  onDownloadClick,
  onPreviewClick,
}: SingleImageHeroLayoutProps) {
  const formattedDate = formatStudioDate(createdAt);
  const imageUrl =
    unlocked && tile.rawUrl ? tile.rawUrl : (tile.outputUrl ?? "");
  return (
    <section
      data-testid="single-image-hero-layout"
      className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:gap-7 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8"
    >
      <SingleImageRail
        sourceUrl={sourceUrl}
        sceneNames={sceneNames}
        formattedDate={formattedDate}
      />
      <SingleImageHero
        tile={tile}
        imageUrl={imageUrl}
        unlocked={unlocked}
        onDownload={() => onDownloadClick(tile.sceneSlug)}
        onPreview={() => onPreviewClick(tile.sceneSlug)}
      />
    </section>
  );
}

function SingleImageRail({
  sourceUrl,
  sceneNames,
  formattedDate,
}: {
  sourceUrl?: string;
  sceneNames: string[];
  formattedDate: string;
}) {
  // Ivory card per spec — subtle border, soft shadow, large radius.
  // Distinct from StudioCompleteLayout's notes column because this is
  // the only sibling to the hero, so it needs enough presence to balance
  // the image without becoming a heavy panel.
  return (
    <aside
      className="flex flex-col gap-6 self-start rounded-3xl border border-line-soft bg-surface p-6 shadow-[0_10px_30px_-18px_rgba(40,30,20,0.25)] md:p-7"
      data-testid="single-image-rail"
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">
          Your product
        </p>
        <div className="mt-4 aspect-square w-full overflow-hidden rounded-2xl bg-paper shadow-[0_2px_10px_-4px_rgba(40,30,20,0.18)]">
          {sourceUrl ? (
            <img
              src={sourceUrl}
              alt="Your product"
              draggable={false}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
              No product
            </div>
          )}
        </div>
        {sceneNames.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {sceneNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-full border border-terracotta/35 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta-dark"
              >
                {name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-line-soft pt-5">
        <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-dark">
          <span aria-hidden>
            <SparkleIcon />
          </span>
          1 asset generated
        </p>
        <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-4">
          {formattedDate}
        </p>
      </div>

      <p className="inline-flex items-center gap-2 border-t border-line-soft pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">
        <LockIcon size={11} /> Secure · Private · Yours
      </p>
    </aside>
  );
}

function SingleImageHero({
  tile,
  imageUrl,
  unlocked,
  onDownload,
  onPreview,
}: {
  tile: TileResult;
  imageUrl: string;
  unlocked: boolean;
  onDownload: () => void;
  onPreview: () => void;
}) {
  // Outer is a div (not a button) — the inner Download CTA is a real
  // <button>, and HTML doesn't allow button-in-button. Keyboard
  // accessibility is preserved via role + Enter/Space handler.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview();
        }
      }}
      data-testid="single-image-hero"
      data-scene-slug={tile.sceneSlug}
      aria-label={`Preview ${tile.sceneName} in HD`}
      className="group relative block aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-3xl bg-ink shadow-[0_14px_40px_-18px_rgba(20,15,10,0.45)] transition-[transform,box-shadow] duration-[600ms] ease-out hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-22px_rgba(20,15,10,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={tile.sceneName}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-[1200ms] ease-out group-hover:scale-[1.012] group-hover:[filter:contrast(1.04)_saturate(1.04)]"
          style={{
            objectPosition: tile.focalPoint
              ? `${Math.round(tile.focalPoint.x * 100)}% ${Math.round(tile.focalPoint.y * 100)}%`
              : "center",
          }}
        />
      ) : null}

      {/* Bottom gradient anchors the editorial copy + CTA without
          competing with the imagery at rest. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(15,12,10,0) 45%, rgba(15,12,10,0.30) 75%, rgba(15,12,10,0.72) 100%)",
        }}
      />

      {/* Top-left: 01 · SCENE NAME with the small terracotta hairline */}
      <div
        className="absolute left-5 top-5 flex flex-col items-start gap-1.5 md:left-7 md:top-7"
        style={{ zIndex: 30 }}
      >
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-cream">
          <span className="text-cream/65">01</span>
          <span className="ml-2">{tile.sceneName}</span>
        </p>
        <span aria-hidden className="block h-px w-8 bg-terracotta" />
      </div>

      {/* Bottom-left editorial overlay: serif headline + sans subcopy +
          single terracotta Download HD pill. */}
      <div
        className="absolute left-5 bottom-5 flex max-w-[min(80%,520px)] flex-col items-start gap-3 md:left-7 md:bottom-7"
        style={{ zIndex: 30 }}
      >
        <p className="font-serif text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.05] tracking-[-0.01em] text-cream">
          Free hero shot
        </p>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-cream/85">
          {unlocked ? "Ready to download" : "No watermark · Ready to download"}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          data-testid="single-image-download"
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-cream shadow-[0_6px_22px_-8px_rgba(0,0,0,0.55)] transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-terracotta-dark hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
        >
          <DownloadIcon />
          Download HD
        </button>
      </div>

      {/* Bottom-right HD READY pill */}
      <div
        className="absolute right-5 bottom-5 inline-flex items-center rounded-full border border-cream/35 bg-black/40 px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-cream backdrop-blur-sm md:right-7 md:bottom-7"
        style={{ zIndex: 30 }}
      >
        HD Ready
      </div>
    </div>
  );
}
