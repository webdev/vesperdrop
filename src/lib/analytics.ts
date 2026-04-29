"use client";

import posthog from "posthog-js";

export type AnalyticsEvent =
  | { name: "try_upload_started"; props?: { source: "drop" | "browse" | "sample" } }
  | { name: "try_scene_picked"; props: { slug: string; total_picked: number } }
  | { name: "try_develop_started"; props: { scene_count: number } }
  | { name: "try_develop_complete"; props: { scene_count: number; skipped_animation: boolean } }
  | { name: "try_signup_gate_seen"; props?: never }
  | { name: "try_signup_clicked"; props?: never }
  | { name: "pricing_plan_clicked"; props: { plan: string; billing: "monthly" | "yearly" } }
  | { name: "pricing_pack_clicked"; props: { credits: number } }
  | { name: "checkout_success"; props: { source: "subscription" | "pack" } }
  | { name: "upgrade_clicked"; props: { location: "account" | "try" | "pricing" } }
  | { name: "user_signed_up"; props: { method: "email" | "google" | "facebook" | "apple" } }
  | { name: "user_signed_in"; props: { method: "email" | "google" | "facebook" | "apple" } }
  | { name: "run_complete"; props: { run_id: string; succeeded: number; failed: number; total: number } };

export function track<E extends AnalyticsEvent>(name: E["name"], props?: E["props"]) {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.capture(name, props as Record<string, unknown> | undefined);
}

export function identify(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.identify(userId, traits);
}

export function resetIdentity() {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.reset();
}
