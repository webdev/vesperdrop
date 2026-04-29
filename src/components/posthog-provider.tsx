"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { clientEnv } from "@/lib/env.client";

let initialized = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = clientEnv.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!token || initialized) return;
    posthog.init(token, {
      api_host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      capture_exceptions: true,
      person_profiles: "identified_only",
      session_recording: { maskAllInputs: true },
    });
    initialized = true;
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const url =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return children;
}
