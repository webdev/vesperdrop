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
    const url = new URL("/sign-up", window.location.origin);
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
    <div className="rounded-2xl border border-line-soft bg-surface p-8 md:p-10">
      <h2 className="font-serif text-[clamp(1.6rem,2.2vw,2.25rem)] leading-[1.1] tracking-[-0.015em]">
        Ready to create your own stunning images?
      </h2>
      <p className="mt-2 max-w-[44ch] text-[14px] text-ink-3">
        Join Vesperdrop and transform your products in minutes.
      </p>

      <form onSubmit={onEmailSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-full border border-line bg-paper px-4 py-3 text-[14px] focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ink px-6 py-3 text-[14px] font-medium text-cream hover:bg-ink-2 disabled:opacity-50"
        >
          Start your free trial
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-ink-4">
        <span className="h-px flex-1 bg-line-soft" /> or <span className="h-px flex-1 bg-line-soft" />
      </div>

      <button
        type="button"
        onClick={onGoogle}
        disabled={busy}
        className="w-full rounded-full border border-line bg-paper px-6 py-3 text-[14px] text-ink hover:bg-surface disabled:opacity-50"
      >
        Continue with Google
      </button>

      <ul className="mt-6 grid grid-cols-1 gap-2 text-[12px] text-ink-3 sm:grid-cols-3">
        <li>7-day free trial</li>
        <li>Cancel anytime</li>
        <li>No credit card required</li>
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
  }, [props.token, props.candidateId, props.sellerName, props.listingUrl]);
  return null;
}
