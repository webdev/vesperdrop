"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { OtpAuthFlow } from "@/components/app/otp-auth-flow";
import type { PreviewPageData } from "@/lib/preview-pages/loader";

type Props = { data: PreviewPageData };

function postEvent(token: string, body: Record<string, unknown>) {
  return fetch(`/api/public/preview-events/${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

function nextWithAttribution(data: PreviewPageData) {
  const params = new URLSearchParams({
    source: data.sourceType,
    preview_token: data.token,
  });
  return `/app?${params.toString()}`;
}

export function PreviewCta({ data }: Props) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const ctaFired = useRef(false);

  const common = {
    preview_token: data.token,
    preview_id: data.id,
    source_type: data.sourceType,
  };

  function fireCtaOnce(label: "start_trial" | "google", destination: string) {
    if (ctaFired.current) return;
    ctaFired.current = true;
    track("preview_cta_click", { ...common, cta_label: label, destination });
    void postEvent(data.token, { kind: "cta_click", label });
  }

  async function handleGoogle() {
    fireCtaOnce("google", "oauth:google");
    track("preview_signup_start", { ...common, signup_method: "google" });
    void postEvent(data.token, { kind: "signup_start", label: "google" });
    const next = nextWithAttribution(data);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function handleOtpSuccess() {
    track("preview_signup_start", { ...common, signup_method: "email" });
    void postEvent(data.token, { kind: "signup_start", label: "email" });
    track("user_signed_up", { method: "email" });
    router.push(nextWithAttribution(data));
    router.refresh();
  }

  return (
    <div className="relative mx-auto max-w-[1080px] overflow-hidden rounded-[36px] border border-line-soft/80 bg-cream/70 p-8 md:p-14 ring-1 ring-paper/60 shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_36px_70px_-30px_rgba(40,30,20,0.4)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-paper/70 to-transparent"
      />

      <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">
            Start your own campaign
          </p>
          <h2 className="mt-4 font-serif text-[clamp(2rem,2.8vw,2.85rem)] leading-[1.04] tracking-[-0.022em] text-ink">
            Ready to create your own stunning images?
          </h2>
          <p className="mt-3 max-w-[40ch] text-[14.5px] leading-[1.6] text-ink-3">
            Transform your products into premium product campaigns in minutes.
            Your first photo&rsquo;s on us — see what Vesperdrop can do for
            your store.
          </p>
        </div>

        <div className="w-full">
          <div onFocus={() => fireCtaOnce("start_trial", "/sign-up")}>
            <OtpAuthFlow
              surface="preview_cta"
              onSuccess={handleOtpSuccess}
              eyebrow={null}
              description={null}
              autoFocusEmail={false}
            />
          </div>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line-soft" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
              or
            </span>
            <span className="h-px flex-1 bg-line-soft" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-paper px-4 py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:bg-surface"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <ul className="mt-5 grid grid-cols-1 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4 sm:grid-cols-3">
            <li>First photo free</li>
            <li>Cancel anytime</li>
            <li>No credit card required</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function PreviewViewTracker({ data }: Props) {
  useEffect(() => {
    track("preview_page_view", {
      preview_token: data.token,
      preview_id: data.id,
      source_type: data.sourceType,
    });
    void postEvent(data.token, { kind: "view" });
  }, [data.token, data.id, data.sourceType]);
  return null;
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58Z" />
    </svg>
  );
}
