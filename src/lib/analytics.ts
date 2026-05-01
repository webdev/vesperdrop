"use client";

import posthog from "posthog-js";

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
  | { name: "try_locked_tile_clicked"; props?: never }
  | { name: "pricing_plan_clicked"; props: { plan: string; billing: "monthly" | "yearly" } }
  | { name: "pricing_pack_clicked"; props: { credits: number } }
  | { name: "checkout_success"; props: { source: "subscription" | "pack" } }
  | { name: "upgrade_clicked"; props: { location: "account" | "try" | "pricing" } }
  | { name: "plan_choose_clicked"; props: { plan: string; location: "account" } }
  | { name: "plan_switch_clicked"; props: { plan: string; location: "account" } }
  | { name: "user_signed_up"; props: { method: "email" | "google" | "facebook" | "apple" } }
  | { name: "user_signed_in"; props: { method: "email" | "google" | "facebook" | "apple" } }
  | { name: "run_complete"; props: { run_id: string; succeeded: number; failed: number; total: number } }
  | { name: "try_batch_started"; props: { batchId: string; slugs: string[] } }
  | { name: "try_batch_completed"; props: { batchId: string; doneCount: number; errorCount: number; totalMs: number } }
  | { name: "try_batch_abandoned"; props: { batchId: string; elapsedMs: number } }
  | { name: "try_stream_attributes"; props: { batchId: string; slug: string; hasAttributes: boolean } }
  | { name: "try_stream_phase"; props: { batchId: string; slug: string; phaseId: string; elapsedMs: number } }
  | { name: "try_stream_completed"; props: { batchId: string; slug: string; totalMs: number } }
  | { name: "try_stream_error"; props: { batchId: string; slug: string; message: string; retryable: boolean } };

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
