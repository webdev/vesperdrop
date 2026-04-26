"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function StickyCta() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Link
      href="/try"
      className={`fixed right-6 bottom-6 z-40 hidden items-center gap-2 rounded-full bg-[var(--color-ember)] px-5 py-3 font-mono text-xs font-medium tracking-[0.14em] text-[var(--color-cream)] uppercase shadow-[0_8px_30px_rgba(194,69,28,0.35)] transition-all hover:scale-[1.04] md:inline-flex ${
        visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-4"
      }`}
      aria-label="Try Darkroom free"
    >
      Try free &rarr;
    </Link>
  );
}
