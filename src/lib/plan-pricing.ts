// Client-safe single source of truth for static plan pricing facts:
// the flat monthly list price and the number of photos included per month.
//
// Both the server-only catalog (`@/lib/plans`) and client UI (marketing
// pricing, the /try upsells) import from here so plan price/quota copy can
// never drift out of sync (VES-55). Stripe price IDs and env-driven config
// stay in `@/lib/plans` (server-only). Keep this module free of
// `server-only` and env imports so client components can use it.

export type PlanSlug = "free" | "starter" | "pro" | "studio" | "agency";

/** Flat list price per month, in USD. */
export const PLAN_MONTHLY_USD: Record<PlanSlug, number> = {
  free: 0,
  starter: 19,
  pro: 39,
  studio: 99,
  agency: 499,
};

/** Photos included per month — drives both "N photos" marketing copy and
 *  the server-side monthly quota (`PLAN_QUOTA.monthlyQuota`). */
export const PLAN_MONTHLY_PHOTOS: Record<PlanSlug, number> = {
  free: 0,
  starter: 25,
  pro: 75,
  studio: 250,
  agency: 1500,
};
