"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fireCompleteRegistration,
  isNewGoogleRegistration,
} from "@/lib/meta-pixel";

// Per-account guard so a page refresh on the post-OAuth landing can't
// re-fire CompleteRegistration. The created_at≈now window would still be
// open on a quick refresh, so the localStorage flag is the real
// idempotency key.
const guardKey = (userId: string) => `vd_reg_fired_${userId}`;

/**
 * Fires Meta's `CompleteRegistration` (method: 'google') after a NEW
 * account signs up via Google at the Download HD gate (VES-58).
 *
 * Why here and not in EmailPasswordAuthFlow: Google OAuth is a full-page
 * redirect (VES-40) — the /try AuthModal unmounts before a session
 * exists, so its in-place `onSuccess` never runs for Google. The OAuth
 * callback lands the authed user back on /try/b/<token>, which is where
 * we can finally read the user and decide new-vs-returning.
 *
 * Email+password registrations are fired in-place by EmailPasswordAuthFlow
 * and are NOT re-fired here: `isNewGoogleRegistration` requires a Google
 * provider, so an email+password user landing here is ignored.
 */
export function GoogleRegistrationPixel() {
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      if (!isNewGoogleRegistration(user)) return;

      // Idempotency: one CompleteRegistration per account, even across
      // refreshes of this landing page.
      try {
        if (localStorage.getItem(guardKey(user.id))) return;
        localStorage.setItem(guardKey(user.id), "1");
      } catch {
        // localStorage unavailable (private mode / blocked) — fall through
        // and fire anyway; the created_at window still bounds duplicates.
      }

      const createdSeed = user.created_at
        ? Date.parse(user.created_at)
        : undefined;
      fireCompleteRegistration({
        userId: user.id,
        method: "google",
        seed:
          createdSeed === undefined || Number.isNaN(createdSeed)
            ? undefined
            : createdSeed,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
