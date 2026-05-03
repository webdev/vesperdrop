"use client";

import { useSyncExternalStore } from "react";

const COOKIE_NAME = "vd_mock_gen";
const CHANGE_EVENT = "vd_mock_change";

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}
function readClient() {
  return document.cookie.split("; ").some((c) => c === `${COOKIE_NAME}=1`);
}
function readServer() {
  return false;
}

/**
 * Floating dev-only pill that flips the `vd_mock_gen` cookie on/off.
 * Generation routes read the cookie server-side and short-circuit to a
 * mock response when set, so admins can prototype UI without burning
 * real credits.
 *
 * Mount on any page that exposes a generation surface. The render-side
 * gate is the caller's responsibility (admin email + non-prod env).
 */
export function MockGenToggle() {
  const on = useSyncExternalStore(subscribe, readClient, readServer);

  function toggle() {
    document.cookie = !on
      ? `${COOKIE_NAME}=1; path=/; max-age=86400; samesite=lax`
      : `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle mock generation"
      className="fixed bottom-4 right-4 z-50 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 shadow-card transition-colors hover:border-terracotta"
    >
      Mock gen:{" "}
      <span
        suppressHydrationWarning
        className={on ? "text-terracotta" : "text-ink-3"}
      >
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}
