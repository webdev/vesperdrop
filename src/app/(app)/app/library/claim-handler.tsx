"use client";

import { useEffect } from "react";

const PENDING_BATCH_KEY = "vd_pending_batch";

/**
 * Vestigial. The magic-link era flow used to write a pending batch
 * into localStorage and pick it up here, posting to /api/try/claim to
 * create real runs+generations rows owned by the user — without going
 * through the unlock_batches paywall. With OTP-inline that bypass
 * became dangerous: a user clicking the magic link (still present in
 * Supabase's email templates) instead of entering the code would land
 * here and silently unlock all 3 generations without paying.
 *
 * The component now only does cleanup: clears any stale storage keys
 * so a returning user from the legacy flow doesn't carry pending
 * state forward, and never calls /api/try/claim from here. The
 * canonical post-claim home is /try/b/[token].
 */
export function ClaimHandler() {
  useEffect(() => {
    try {
      window.localStorage.removeItem(PENDING_BATCH_KEY);
      window.sessionStorage.removeItem(PENDING_BATCH_KEY);
    } catch {}
  }, []);
  return null;
}
