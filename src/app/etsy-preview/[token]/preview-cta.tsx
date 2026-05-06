"use client";

import { useEffect, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { track, identify } from "@/lib/analytics";

type CtaProps = {
  token: string;
  candidateId: string;
  sellerName: string | null;
  listingUrl: string;
};

export function PreviewCta(props: CtaProps) {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
      // best-effort; don't block the auth flow
    }
  }

  function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    track("etsy_preview_cta_click", { ...common, label: "email_submit" });
    track("etsy_preview_signup_start", { ...common, method: "email" });
    void postEvent("cta_click", "email_submit");
    void postEvent("signup_start", "email");
    start(async () => {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      if (data.user) {
        identify(data.user.id, { email });
        track("user_signed_up", { method: "email" });
      }
      // After signup the next page reads the vd_etsy_ref cookie set on
      // first preview view; no need to forward query params manually.
      window.location.href = "/app";
    });
  }

  async function onGoogle() {
    setError(null);
    track("etsy_preview_cta_click", { ...common, label: "google" });
    track("etsy_preview_signup_start", { ...common, method: "google" });
    void postEvent("cta_click", "google");
    void postEvent("signup_start", "google");
    track("user_signed_up", { method: "google" });
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent("/app")}`,
      },
    });
    if (err) setError(err.message);
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
        Transform your products into premium Etsy-ready campaigns in
        minutes.
      </p>

      <form
        onSubmit={onEmailSubmit}
        className="mx-auto mt-9 flex max-w-[460px] flex-col gap-3"
      >
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-full border border-line bg-paper px-5 py-4 text-[15px] text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          className="w-full rounded-full border border-line bg-paper px-5 py-4 text-[15px] text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-ink px-6 py-4 text-[14px] font-medium tracking-[-0.005em] text-cream transition-colors hover:bg-ink-2 disabled:opacity-50"
        >
          {pending ? "Creating account…" : "Start your free trial"}
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
        disabled={pending}
        className="mx-auto flex w-full max-w-[460px] items-center justify-center gap-3 rounded-full border border-line bg-paper px-6 py-4 text-[14px] tracking-[-0.005em] text-ink transition-colors hover:bg-surface disabled:opacity-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {error ? (
        <p className="mx-auto mt-5 max-w-[460px] text-[12px] text-terracotta">
          {error}
        </p>
      ) : null}

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

function GoogleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
