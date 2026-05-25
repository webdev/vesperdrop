"use client";

// Client-side analytics. Backed by Google Analytics 4 (gtag.js loaded by
// AnalyticsProvider). The event union is the source of truth — server
// events go through `serverTrack` in analytics-server.ts and use the same
// names so dashboards line up.
//
// All entry points are no-ops when gtag isn't on the page (e.g. before
// the GA script loads, or when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset).

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsEvent =
  | { name: "try_upload_started"; props?: { source: "drop" | "browse" | "sample" } }
  | { name: "try_scene_picked"; props: { slug: string; total_picked: number } }
  | { name: "try_develop_started"; props: { scene_count: number } }
  | { name: "try_develop_complete"; props: { scene_count: number } }
  | { name: "try_generate_succeeded"; props: { slug: string } }
  | { name: "try_generate_failed"; props: { slug: string; error: string } }
  | { name: "try_signup_gate_seen"; props?: never }
  | { name: "try_signup_clicked"; props?: { intent?: "default" | "download" | "unlock"; slug?: string } }
  | { name: "try_tile_download_clicked"; props: { slug: string } }
  // Fired AFTER the blob fetch + save completes successfully. Pairs with
  // `try_tile_download_clicked` (intent) to give a true save-rate metric
  // — clicked-but-bounced (auth modal, Stripe redirect, fetch error)
  // never reaches this event.
  | {
      name: "try_tile_download_completed";
      props: { slug: string; size_bytes: number };
    }
  | { name: "try_locked_tile_clicked"; props?: never }
  | { name: "try_unlock_clicked"; props?: never }
  // Fired the moment we redirect to Stripe Checkout. `kind` is the SKU
  // family (one-time unlock vs subscription); `location` is the surface
  // (batch view, scenes upsell, pricing card, etc.). Pairs with
  // `checkout_success` for a Stripe-side conversion rate.
  | {
      name: "checkout_started";
      props: {
        kind: "unlock" | "subscription" | "pack";
        location: "batch" | "try" | "pricing" | "account";
      };
    }
  | { name: "auth_password_signin"; props: { surface: string } }
  | { name: "auth_signup"; props: { surface: string } }
  | { name: "auth_google_start"; props: { surface: string } }
  | { name: "try_studio_claimed"; props?: never }
  | { name: "pricing_plan_clicked"; props: { plan: string; billing: "monthly" | "yearly" | "annual" } }
  | { name: "pricing_billing_toggled"; props: { interval: "monthly" | "annual" } }
  | { name: "pricing_pack_clicked"; props: { credits: number } }
  | { name: "checkout_success"; props: { source: "subscription" | "pack" } }
  | { name: "upgrade_clicked"; props: { location: "account" | "try" | "pricing" } }
  | { name: "plan_choose_clicked"; props: { plan: string; location: "account" } }
  | { name: "plan_switch_clicked"; props: { plan: string; location: "account" } }
  | { name: "complete_look_clicked"; props: { parent_id: string; locked: boolean } }
  | { name: "complete_look_submitted"; props: { platform: string; parent_id: string } }
  | { name: "paywall_upgrade_clicked"; props: { feature: "complete_look"; parent_id: string } }
  | { name: "user_signed_up"; props: { method: "email" | "google" | "facebook" | "apple" } }
  | { name: "user_signed_in"; props: { method: "email" | "google" | "facebook" | "apple" } }
  | { name: "run_complete"; props: { run_id: string; succeeded: number; failed: number; total: number } }
  | {
      name: "image_generated";
      props: {
        run_id: string;
        generation_id: string;
        preset_id: string;
        quality: "preview" | "hd";
        watermarked: boolean;
        duration_ms: number | null;
      };
    }
  | {
      name: "image_failed";
      props: {
        run_id: string;
        generation_id: string;
        preset_id: string;
        error: string;
      };
    }
  | {
      name: "checkout_started";
      props: {
        kind: "subscription" | "plan_switch" | "billing_portal" | "unlock";
        plan?: string;
        interval?: "monthly" | "annual";
        location: "pricing" | "comparison" | "account_grid" | "account_summary" | "hero" | "try" | "batch";
      };
    }
  | { name: "billing_portal_opened"; props: { location: "account_summary" | "account_grid" } }
  | { name: "try_batch_started"; props: { batchId: string; slugs: string[] } }
  | { name: "try_batch_completed"; props: { batchId: string; doneCount: number; errorCount: number; totalMs: number } }
  | { name: "try_batch_abandoned"; props: { batchId: string; elapsedMs: number } }
  | { name: "try_stream_attributes"; props: { batchId: string; slug: string; hasAttributes: boolean } }
  | { name: "try_stream_phase"; props: { batchId: string; slug: string; phaseId: string; elapsedMs: number } }
  | { name: "try_stream_completed"; props: { batchId: string; slug: string; totalMs: number } }
  | { name: "try_stream_error"; props: { batchId: string; slug: string; message: string; retryable: boolean } }
  | {
      name: "etsy_preview_view";
      props: {
        preview_token: string;
        candidate_id: string;
        seller_name: string | null;
        listing_url: string;
        source: "etsy_outreach";
      };
    }
  | {
      name: "etsy_preview_cta_click";
      props: {
        preview_token: string;
        candidate_id: string;
        seller_name: string | null;
        listing_url: string;
        source: "etsy_outreach";
        label: "email_submit" | "google" | "start_trial";
      };
    }
  | {
      name: "etsy_preview_signup_start";
      props: {
        preview_token: string;
        candidate_id: string;
        seller_name: string | null;
        listing_url: string;
        source: "etsy_outreach";
        method: "email" | "google";
      };
    }
  | {
      name: "preview_page_view";
      props: {
        preview_token: string;
        preview_id: string;
        source_type: "etsy_preview" | "ig_leadgen";
      };
    }
  | {
      name: "preview_cta_click";
      props: {
        preview_token: string;
        preview_id: string;
        source_type: "etsy_preview" | "ig_leadgen";
        cta_label: "start_trial" | "google";
        destination: string;
      };
    }
  | {
      name: "preview_signup_start";
      props: {
        preview_token: string;
        preview_id: string;
        source_type: "etsy_preview" | "ig_leadgen";
        signup_method: "email" | "google";
      };
    }
  | { name: "etsy_admin_generation_submitted"; props: { count: number; mock: boolean } }
  | { name: "etsy_admin_generation_completed"; props: { page_id: string; status: "completed" | "partial" | "failed" } }
  | { name: "etsy_admin_copy_preview_link"; props: { page_id: string; preview_token: string } };

export function track<E extends AnalyticsEvent>(name: E["name"], props?: E["props"]) {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("event", name, (props as Record<string, unknown>) ?? undefined);
}

/**
 * Pin a user_id to the GA stream. Subsequent events on this client are
 * attributed to the same person across sessions/devices when the same id
 * is set. Traits become user_properties (24 char keys, 36 char values
 * are GA's hard limits — caller's responsibility to keep small).
 */
export function identify(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("set", "user_properties", { ...(traits ?? {}) });
  window.gtag("set", { user_id: userId });
}

export function resetIdentity() {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("set", { user_id: undefined });
}
