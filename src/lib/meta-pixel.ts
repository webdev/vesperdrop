"use client";

// Meta Pixel (fbq) helpers. The Pixel itself is injected by
// AnalyticsProvider (`fbq('init', …)`); these wrappers are the guarded
// call sites the app fires conversion events through.
//
// Why a wrapper and not bare `window.fbq(...)`: the Pixel loads
// `lazyOnload`, so `fbq` may be absent early in the page lifecycle, and a
// blocked/ad-blocked Pixel must never throw and break a user-visible flow.
// Every call is null-guarded and try/catch-wrapped (mirrors the existing
// `Lead` guard in src/app/try/email-capture.tsx).

type Fbq = (...args: unknown[]) => void;

function getFbq(): Fbq | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { fbq?: Fbq }).fbq;
}

export type SignupMethod = "email_password" | "google";

/**
 * Minimal shape of a Supabase auth user needed to decide whether a
 * post-OAuth landing represents a brand-new account vs a returning
 * sign-in. Mirrors the fields `supabase.auth.getUser()` returns.
 */
export type OAuthUserSignal = {
  id: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  app_metadata?: { provider?: string; providers?: string[] } | null;
  identities?: Array<{ provider?: string } | null> | null;
};

function usesGoogle(user: OAuthUserSignal): boolean {
  if (user.app_metadata?.provider === "google") return true;
  if (user.app_metadata?.providers?.includes("google")) return true;
  return Boolean(user.identities?.some((i) => i?.provider === "google"));
}

/**
 * Decide whether a Google OAuth landing is a NEW registration (VES-58).
 *
 * Google does a full-page redirect, so we can't observe "signUp vs
 * sign-in" in-place the way the email+password flow can. After the
 * redirect we only have the resolved user. Two signals together gate the
 * fire:
 *
 *   1. The account is a Google account (provider/identity check) — guards
 *      against firing `method:'google'` for an email+password user who
 *      merely happened to land here.
 *   2. The account was created essentially now: `created_at` and
 *      `last_sign_in_at` are within `windowMs` of each other. For a
 *      brand-new OAuth account Supabase stamps both at first sign-in, so
 *      they're seconds apart. A RETURNING user's `last_sign_in_at` is
 *      far later than the original `created_at`, so the gap exceeds the
 *      window and we do NOT fire.
 *
 * Limitation: this is heuristic, not a hard "was-just-inserted" signal —
 * Supabase doesn't expose one client-side post-redirect. The
 * created_at≈last_sign_in_at window is the most reliable proxy available
 * (a true returning sign-in always moves last_sign_in_at well past
 * created_at). The localStorage guard at the call site additionally
 * prevents a duplicate fire if the new user refreshes the landing page.
 */
export function isNewGoogleRegistration(
  user: OAuthUserSignal,
  windowMs = 60_000,
): boolean {
  if (!usesGoogle(user)) return false;
  if (!user.created_at) return false;
  const created = Date.parse(user.created_at);
  if (Number.isNaN(created)) return false;
  // No last_sign_in_at yet → treat the freshly-created account as new.
  if (!user.last_sign_in_at) return true;
  const lastSignIn = Date.parse(user.last_sign_in_at);
  if (Number.isNaN(lastSignIn)) return true;
  return Math.abs(lastSignIn - created) <= windowMs;
}

/**
 * Fire Meta's standard `CompleteRegistration` event for a genuinely NEW
 * account created via the Download HD signup (VES-58).
 *
 * MUST only be called on server-confirmed new-account creation — never on
 * button click, signup error, modal dismiss, or returning-user sign-in.
 * Callers own the new-vs-returning decision (the email+password path fires
 * only from the `signUp` success branch; the Google path fires only when
 * the post-OAuth landing detects a freshly-created user).
 *
 * `eventID` is deterministic per registration (`reg-${userId}-${seed}`) so
 * a future Conversions API (CAPI) server fire can dedupe against this
 * browser event. `seed` should be the account `createdAt` epoch ms when
 * available (stable across retries/refreshes); falls back to `Date.now()`.
 */
export function fireCompleteRegistration({
  userId,
  method,
  seed,
}: {
  userId: string;
  method: SignupMethod;
  seed?: number;
}): void {
  const fbq = getFbq();
  if (!fbq) return;
  try {
    fbq(
      "track",
      "CompleteRegistration",
      {
        content_name: "download_signup",
        method,
        value: 0,
        currency: "USD",
      },
      { eventID: `reg-${userId}-${seed ?? Date.now()}` },
    );
  } catch {
    // analytics swallow — a missing/blocked Pixel must not break the flow.
  }
}
