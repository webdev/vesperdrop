"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function StickyMobileCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.5);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-paper/95 backdrop-blur-md transition-transform duration-300 md:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!visible}
    >
      <div className="pointer-events-auto flex items-center justify-between gap-3 px-5 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
          No card required
        </p>
        <Link
          href="/try"
          className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
        >
          First photo free
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
