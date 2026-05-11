/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";
import { OtpAuthFlow } from "@/components/app/otp-auth-flow";
import type { TileResult } from "./develop-grid";

/**
 * Self-contained "claim + upsell + trust row" rail that sits beneath
 * the editorial image stage. Used by:
 *   - /try (in-flow after generation completes)
 *   - /try/b/[token] (rehydrated deep-link page)
 *
 * Both visible simultaneously — the claim form on the left, the $9.99
 * upsell on the right. The user sees the full value/price ladder
 * before pressing either CTA. After OTP success the claim column
 * collapses to a small confirmation badge; the upsell stays visible.
 */
export function EditorialClaimRail({
  generations,
  claimed,
  onClaimSuccess,
  onUnlock,
  unlockSubmitting,
}: {
  generations: TileResult[];
  claimed: boolean;
  onClaimSuccess: (args: { email: string; userId: string }) => void | Promise<void>;
  onUnlock: () => void;
  unlockSubmitting: boolean;
}) {
  // Layout decision: pre-claim, the page is purely a free-preview
  // reveal + claim CTA. The $9.99 upsell only appears once the
  // visitor has authenticated via OTP — that's when they own one
  // HD image and the "complete the set" framing becomes natural.
  return (
    <motion.div
      layout
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className={
        claimed
          ? "mt-12 grid grid-cols-1 items-start gap-10 md:mt-16 md:grid-cols-[1.1fr_auto_0.95fr] md:gap-12"
          : "mt-12 md:mt-16"
      }
    >
      <ClaimColumn claimed={claimed} onClaimSuccess={onClaimSuccess} />

      {claimed ? (
        <>
          <div
            aria-hidden
            className="hidden self-stretch md:block md:w-px md:bg-line-soft"
          />

          <UpsellColumn
            generations={generations}
            onUnlock={onUnlock}
            disabled={unlockSubmitting}
            claimed={claimed}
          />
        </>
      ) : null}
    </motion.div>
  );
}

// Left column: headline + subcopy + OTP form + microcopy. Collapses
// to a confirmation badge after claim.
function ClaimColumn({
  claimed,
  onClaimSuccess,
}: {
  claimed: boolean;
  onClaimSuccess: (args: { email: string; userId: string }) => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-serif text-[clamp(2rem,3.4vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ink">
          Claim your{" "}
          <em className="not-italic font-serif italic text-terracotta-dark">
            studio
          </em>
          .
        </h2>
        <p className="mt-2 max-w-[36ch] text-[14.5px] leading-[1.55] text-ink-3">
          {claimed
            ? "Your studio is saved. Your hero shot is ready to download — complete the set to unlock the rest."
            : "Enter your email to save this batch and unlock your first HD image."}
        </p>
      </div>

      {claimed ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-terracotta-wash px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-terracotta-dark"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2.5 6.5l2.5 2.5 4.5-5" />
          </svg>
          Studio claimed
        </motion.div>
      ) : (
        <>
          <OtpAuthFlow
            surface="try_inline_claim"
            onSuccess={onClaimSuccess}
            eyebrow={null}
            description={null}
            layout="horizontal"
          />
          <ClaimMicrocopy />
        </>
      )}
    </div>
  );
}

// Three small icon + label items below the email form: a quiet trust
// signal. Icons are inline SVG so we don't ship an icon set just for
// these three slots.
function ClaimMicrocopy() {
  const items: { label: string; icon: React.ReactNode }[] = [
    {
      label: "No passwords",
      icon: (
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
          <rect x="4" y="11" width="16" height="10" rx="1.5" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      ),
    },
    {
      label: "Private",
      icon: (
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
          <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" />
        </svg>
      ),
    },
    {
      label: "Takes 30 seconds",
      icon: (
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
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      ),
    },
  ];
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-ink-4">
            {it.icon}
          </span>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

// Right column: $9.99 upsell. Mini thumbnails on the left, copy + CTA
// on the right. After OTP claim the hero thumbnail loses its lock.
function UpsellColumn({
  generations,
  onUnlock,
  disabled,
  claimed,
}: {
  generations: TileResult[];
  onUnlock: () => void;
  disabled: boolean;
  claimed: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-5 md:items-end md:text-right">
      <div className="flex w-full items-stretch gap-5 md:flex-row-reverse">
        <div className="flex flex-col gap-2 md:items-end">
          <h3 className="font-serif text-[clamp(1.375rem,1.6vw,1.5rem)] leading-[1.1] tracking-[-0.01em] text-ink">
            Complete the studio set
          </h3>
          <p className="font-serif text-[clamp(1.625rem,2.2vw,2rem)] leading-none tracking-[-0.01em] text-terracotta-dark">
            $9.99
          </p>
        </div>
        <UpsellThumbnails results={generations} claimed={claimed} />
      </div>

      <ul className="flex flex-col gap-1 text-[14px] text-ink-2 md:items-end">
        {[
          "2 additional HD images",
          "No watermark",
          "Commercial use license",
          "Instant download",
        ].map((item) => (
          <li key={item} className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-terracotta text-cream"
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 6.5l2.5 2.5 4.5-5" />
              </svg>
            </span>
            {item}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onUnlock}
        disabled={disabled}
        data-testid="inline-unlock-cta"
        className="group inline-flex items-center gap-2 rounded-full border border-terracotta px-6 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-terracotta-dark transition-colors hover:bg-terracotta-wash disabled:cursor-not-allowed disabled:opacity-60"
      >
        Unlock remaining 2 images
        <span
          aria-hidden
          className="transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </button>

      <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="4" y="11" width="16" height="10" rx="1.5" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Secure checkout powered by Stripe
      </p>
    </div>
  );
}

// Three small image thumbnails reflecting the generations. The
// hero (index 0) gets a terracotta ring; locked indexes show a lock.
function UpsellThumbnails({
  results,
  claimed,
}: {
  results: TileResult[];
  claimed: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {results.map((r, i) => {
        const isHero = i === 0;
        const isLocked = i !== 0 || !claimed;
        return (
          <div
            key={r.sceneSlug}
            className={`relative aspect-[4/5] w-12 overflow-hidden rounded-sm bg-zinc-900 ${
              isHero ? "ring-2 ring-terracotta ring-offset-1 ring-offset-paper" : ""
            }`}
          >
            {r.outputUrl ? (
              <img
                src={r.outputUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-90"
                draggable={false}
              />
            ) : null}
            {isLocked && !(isHero && claimed) ? (
              <div className="absolute inset-0 flex items-center justify-center bg-ink/45 text-cream">
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
                  <rect x="4" y="11" width="16" height="10" rx="1.5" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// Quiet trust row at the bottom of the conversion section. Mono caps
// label + monochrome wordmark logos. Drop in proper SVG logos later
// by replacing the brands array with asset paths.
export function TrustRow() {
  const brands = ["ZARA", "alo", "FEW MODA", "vuori", "KOTN"];
  return (
    <div className="mt-16 border-t border-line-soft pt-8">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
        Trusted by creators and brands worldwide
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
        {brands.map((b) => (
          <span
            key={b}
            className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-4"
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}
