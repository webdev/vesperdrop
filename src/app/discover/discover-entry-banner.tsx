"use client";

const TASTE_PILLS = ["Soft light", "Clean studio", "Golden hour"] as const;

interface Props {
  /** DOM id of the carousel anchor — clicking "Start swiping" scrolls to it. */
  scrollTargetId: string;
}

/**
 * Subtle entry orientation banner above the carousel. Reads as an editorial
 * guide card, not a marketing block. Three columns on desktop (label/copy →
 * taste pills → keyboard hint + CTA) that stack vertically on small viewports.
 */
export function DiscoverEntryBanner({ scrollTargetId }: Props) {
  function handleStart() {
    const el = document.getElementById(scrollTargetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section
      className="mx-auto w-full max-w-[1100px] opacity-0 motion-safe:animate-[entry-fadein_300ms_ease-out_forwards]"
      style={{
        background: "#F6F3EE",
        border: "1px solid rgba(0,0,0,0.05)",
        borderRadius: 24,
        padding: "28px 32px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.025)",
      }}
    >
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1.2fr_1fr_auto] md:gap-8">
        {/* LEFT — label + headline + body */}
        <div>
          <p
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              color: "rgba(0,0,0,0.45)",
              marginBottom: 8,
            }}
          >
            Discovery session
          </p>
          <h2
            className="font-serif"
            style={{
              fontSize: 26,
              lineHeight: 1.15,
              color: "#1A1A1A",
            }}
          >
            Pick what feels right.
          </h2>
          <p
            className="mt-2"
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: "rgba(0,0,0,0.6)",
              maxWidth: 360,
            }}
          >
            Your choices help shape the looks we&rsquo;ll generate for your
            product.
          </p>
        </div>

        {/* CENTER — taste signal pills (hidden on cramped widths) */}
        <ul className="hidden flex-wrap items-center gap-2 lg:flex">
          {TASTE_PILLS.map((label) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5"
              style={{
                background: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(0,0,0,0.06)",
                padding: "8px 12px",
                borderRadius: 999,
                fontSize: 12,
                color: "rgba(0,0,0,0.65)",
              }}
            >
              <span aria-hidden style={{ color: "#c2604c" }}>
                ✦
              </span>
              {label}
            </li>
          ))}
        </ul>

        {/* RIGHT — keyboard hint + CTA */}
        <div className="flex flex-col items-start gap-2 md:items-end">
          <p
            className="font-mono"
            style={{ fontSize: 13, color: "rgba(0,0,0,0.55)" }}
          >
            Use ← and → keys
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center gap-2 rounded-full transition-all duration-200 ease-out hover:-translate-y-px"
            style={{
              padding: "10px 16px",
              fontSize: 13,
              background: "#1A1A1A",
              color: "white",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#000";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(0,0,0,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#1A1A1A";
              e.currentTarget.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
            }}
          >
            Start swiping <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes entry-fadein {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
