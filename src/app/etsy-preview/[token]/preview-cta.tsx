"use client";

import { useEffect, useRef } from "react";
import { AuthForm } from "@/components/app/auth-form";
import { track } from "@/lib/analytics";

type CtaProps = {
  token: string;
  candidateId: string;
  sellerName: string | null;
  listingUrl: string;
};

export function PreviewCta(props: CtaProps) {
  const fired = useRef(false);

  const common = {
    preview_token: props.token,
    candidate_id: props.candidateId,
    seller_name: props.sellerName,
    listing_url: props.listingUrl,
    source: "etsy_outreach" as const,
  };

  // Fire CTA-click + signup_start exactly once per page load on the first
  // interaction with the auth form (focus, click, or keypress). AuthForm
  // itself fires user_signed_up on completion. We also POST the server
  // events so the admin counters bump.
  function fireOnFirstInteraction() {
    if (fired.current) return;
    fired.current = true;
    track("etsy_preview_cta_click", { ...common, label: "start_trial" });
    track("etsy_preview_signup_start", { ...common, method: "email" });
    void fetch(`/api/public/etsy-preview/${props.token}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "cta_click", label: "start_trial" }),
    }).catch(() => {});
    void fetch(`/api/public/etsy-preview/${props.token}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "signup_start", label: "start_trial" }),
    }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-[600px] rounded-[36px] border border-line-soft bg-cream/70 p-9 text-center md:p-12 shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_50px_100px_-60px_rgba(40,30,20,0.25)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">
        Start your own campaign
      </p>
      <h2 className="mt-4 font-serif text-[clamp(2rem,2.8vw,2.85rem)] leading-[1.04] tracking-[-0.022em] text-ink">
        Ready to create your own stunning images?
      </h2>
      <p className="mx-auto mt-3 max-w-[40ch] text-[14px] leading-[1.55] text-ink-3">
        Transform your products into premium Etsy-ready campaigns in
        minutes.
      </p>

      <div
        className="mx-auto mt-7 max-w-[440px] text-left"
        onFocusCapture={fireOnFirstInteraction}
        onPointerDownCapture={fireOnFirstInteraction}
      >
        <AuthForm mode="sign-up" variant="split" next="/app" />
      </div>

      <ul className="mx-auto mt-7 grid max-w-[480px] grid-cols-1 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4 sm:grid-cols-3">
        <li>No credit card required</li>
        <li>Cancel anytime</li>
        <li>First previews are free</li>
      </ul>
    </div>
  );
}

export function PreviewViewTracker(props: CtaProps) {
  useEffect(() => {
    track("etsy_preview_view", {
      preview_token: props.token,
      candidate_id: props.candidateId,
      seller_name: props.sellerName,
      listing_url: props.listingUrl,
      source: "etsy_outreach",
    });
    // Server-side counter + attribution cookie (deduped per session by
    // the route handler).
    fetch(`/api/public/etsy-preview/${props.token}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "view" }),
    }).catch(() => {
      // best-effort; doesn't block the page
    });
  }, [props.token, props.candidateId, props.sellerName, props.listingUrl]);
  return null;
}
