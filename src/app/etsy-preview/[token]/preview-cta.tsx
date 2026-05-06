"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

type CtaProps = {
  token: string;
  candidateId: string;
  sellerName: string | null;
  listingUrl: string;
};

export function PreviewCta(props: CtaProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const common = {
    preview_token: props.token,
    candidate_id: props.candidateId,
    seller_name: props.sellerName,
    listing_url: props.listingUrl,
    source: "etsy_outreach" as const,
  };

  async function postEvent(kind: "cta_click" | "signup_start", label: string) {
    try {
      await fetch(`/api/public/etsy-preview/${props.token}/event`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, label }),
      });
    } catch {
      // best-effort; don't block the navigation
    }
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    track("etsy_preview_cta_click", { ...common, label: "email_submit" });
    track("etsy_preview_signup_start", { ...common, method: "email" });
    await postEvent("cta_click", "email_submit");
    await postEvent("signup_start", "email");
    const url = new URL("/sign-in", window.location.origin);
    url.searchParams.set("ref", "etsy-preview");
    url.searchParams.set("token", props.token);
    url.searchParams.set("email", email);
    window.location.href = url.toString();
  }

  async function onGoogle() {
    setBusy(true);
    track("etsy_preview_cta_click", { ...common, label: "google" });
    track("etsy_preview_signup_start", { ...common, method: "google" });
    await postEvent("cta_click", "google");
    await postEvent("signup_start", "google");
    const url = new URL("/sign-in", window.location.origin);
    url.searchParams.set("ref", "etsy-preview");
    url.searchParams.set("token", props.token);
    url.searchParams.set("provider", "google");
    window.location.href = url.toString();
  }

  return (
    <div className="mx-auto max-w-[640px] rounded-[36px] border border-line-soft bg-cream/70 p-10 text-center md:p-14 shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_50px_100px_-60px_rgba(40,30,20,0.25)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">
        Start your own campaign
      </p>
      <h2 className="mt-5 font-serif text-[clamp(1.85rem,2.6vw,2.6rem)] leading-[1.05] tracking-[-0.02em] text-ink">
        Ready to create your own stunning images?
      </h2>
      <p className="mx-auto mt-4 max-w-[42ch] text-[14px] leading-[1.6] text-ink-3">
        Transform your products into premium Shopify-ready campaigns in
        minutes.
      </p>

      <form
        onSubmit={onEmailSubmit}
        className="mx-auto mt-9 flex max-w-[460px] flex-col gap-3"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-full border border-line bg-paper px-5 py-4 text-[15px] text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-ink px-6 py-4 text-[14px] font-medium tracking-[-0.005em] text-cream transition-colors hover:bg-ink-2 disabled:opacity-50"
        >
          Start your free trial
        </button>
      </form>

      <div className="mx-auto my-7 flex max-w-[460px] items-center gap-4 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">
        <span className="h-px flex-1 bg-line-soft" />
        or
        <span className="h-px flex-1 bg-line-soft" />
      </div>

      <button
        type="button"
        onClick={onGoogle}
        disabled={busy}
        className="mx-auto block w-full max-w-[460px] rounded-full border border-line bg-paper px-6 py-4 text-[14px] tracking-[-0.005em] text-ink transition-colors hover:bg-surface disabled:opacity-50"
      >
        Continue with Google
      </button>

      <ul className="mx-auto mt-9 grid max-w-[520px] grid-cols-1 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4 sm:grid-cols-3">
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
