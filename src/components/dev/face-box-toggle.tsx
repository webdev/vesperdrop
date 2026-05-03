"use client";

import { useSyncExternalStore } from "react";

const COOKIE_NAME = "vd_show_face_box";
const CHANGE_EVENT = "vd_face_box_change";

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

/** Subscribe to the face-box overlay toggle. Returns true when enabled. */
export function useFaceBoxEnabled(): boolean {
  return useSyncExternalStore(subscribe, readClient, readServer);
}

/**
 * Floating dev pill that flips the `vd_show_face_box` cookie. When on, tiles
 * draw the Sceneify face bounding box + focal point on top of generated
 * images so we can verify detection quality. Render-side gating (admin +
 * non-prod env) is the caller's responsibility.
 */
export function FaceBoxToggle() {
  const on = useFaceBoxEnabled();

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
      aria-label="Toggle face box overlay"
      className="fixed bottom-4 right-40 z-50 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 shadow-card transition-colors hover:border-terracotta"
    >
      Face box:{" "}
      <span
        suppressHydrationWarning
        className={on ? "text-terracotta" : "text-ink-3"}
      >
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}
