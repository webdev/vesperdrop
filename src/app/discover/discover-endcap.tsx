/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Props {
  /** Real liked count drives the headline copy. */
  likedCount: number;
  /** Up to 4 hero image URLs reused for the layered thumbnail composition. */
  thumbnails: string[];
}

/**
 * Editorial end cap below the swipe deck. Centered editorial card that
 * reinforces progress and offers a primary path to upload + a secondary
 * "keep exploring" affordance. Fades in on scroll via IntersectionObserver.
 */
export function DiscoverEndcap({ likedCount, thumbnails }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            return;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const headline =
    likedCount > 10
      ? "You're ready to create something real."
      : likedCount >= 5
        ? "Your aesthetic is taking shape."
        : "Start shaping your aesthetic.";

  const thumbs = thumbnails.slice(0, 4);

  return (
    <>
      {/* Top divider — sits above the banner with 48px gap before the card. */}
      <div
        aria-hidden
        className="mx-auto h-px max-w-[1100px]"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(0,0,0,0.08) 20%, rgba(0,0,0,0.08) 80%, transparent)",
        }}
      />

      <section
        ref={ref}
        className={`mx-auto !mt-12 w-full max-w-[1100px] rounded-[28px] px-10 py-12 transition-all duration-[400ms] ease-out md:px-[72px] md:py-16 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{
          background:
            "linear-gradient(to bottom, #F6F3EE 0%, #F4F1EC 100%)",
          border: "1px solid rgba(0,0,0,0.04)",
          // Bumped per density spec — stronger soft drop reads as a
          // layered editorial card connected to the helper text above.
          boxShadow: "0 20px 60px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex flex-col items-center gap-10 text-center md:flex-row md:items-center md:justify-between md:gap-12 md:text-left">
          <div className="max-w-[460px]">
            <p
              className="font-mono uppercase"
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                color: "rgba(0,0,0,0.45)",
                marginBottom: 16,
              }}
            >
              Discovery
            </p>
            <h2
              className="font-serif"
              style={{
                fontSize: "clamp(2rem, 3.4vw, 2.625rem)",
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
                color: "#1A1A1A",
                marginBottom: 20,
              }}
            >
              {headline}
            </h2>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.6,
                color: "rgba(0,0,0,0.6)",
                marginBottom: 32,
                maxWidth: 420,
              }}
            >
              Every choice refines your eye. Keep going or turn your favorites
              into a complete campaign.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 md:justify-start">
              <Link
                href="/try"
                className="group inline-flex items-center gap-2 rounded-full px-[22px] py-[14px] text-[14px] font-medium text-white transition-all duration-[180ms] ease-out hover:-translate-y-px"
                style={{
                  background: "#1A1A1A",
                  boxShadow: "0 0 0 rgba(0,0,0,0)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#000";
                  e.currentTarget.style.boxShadow =
                    "0 6px 16px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#1A1A1A";
                  e.currentTarget.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
                }}
              >
                Create your first look <span aria-hidden>→</span>
              </Link>
              <button
                type="button"
                onClick={() =>
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }
                className="text-[14px] transition-colors duration-150"
                style={{ color: "rgba(0,0,0,0.6)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#1A1A1A";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(0,0,0,0.6)";
                }}
              >
                Continue exploring
              </button>
            </div>
          </div>

          {thumbs.length > 0 ? (
            <ThumbnailStack thumbs={thumbs} />
          ) : null}
        </div>
      </section>
    </>
  );
}

function ThumbnailStack({ thumbs }: { thumbs: string[] }) {
  // Up to 4 layered thumbnails per spec — front → back, alternating tilt.
  // Hover scales the front one slightly and lifts its shadow.
  const layouts: Array<{
    left: number;
    top: number;
    z: number;
    rotate: number;
    opacity: number;
  }> = [
    { left: 80, top: 0, z: 4, rotate: 0, opacity: 1 },
    { left: 40, top: 20, z: 3, rotate: -3, opacity: 0.9 },
    { left: 120, top: 24, z: 2, rotate: 3, opacity: 0.85 },
    { left: 0, top: 36, z: 1, rotate: -6, opacity: 0.7 },
  ];

  return (
    <div className="relative h-[200px] w-[320px] shrink-0">
      {thumbs.map((url, i) => {
        const layout = layouts[i]!;
        return (
          <div
            key={`${i}-${url}`}
            className="group/thumb absolute h-[180px] w-[140px] overflow-hidden rounded-2xl transition-all duration-200 ease-out hover:scale-[1.02]"
            style={{
              left: layout.left,
              top: layout.top,
              zIndex: layout.z,
              transform: `rotate(${layout.rotate}deg)`,
              opacity: layout.opacity,
              boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
            }}
          >
            <img
              src={url}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
            />
          </div>
        );
      })}
    </div>
  );
}
