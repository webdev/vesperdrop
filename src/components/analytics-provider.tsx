"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { clientEnv } from "@/lib/env.client";

/**
 * Loads gtag.js for Google Analytics 4 and fires a `page_view` event on
 * client-side route changes (Next App Router doesn't trigger gtag's
 * automatic SPA tracking, so we wire it manually). The init script sets
 * `send_page_view: false` so the first paint isn't double-counted.
 *
 * No-ops cleanly when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const measurementId = clientEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!measurementId) return;
    if (typeof window === "undefined" || !window.gtag) return;
    const url =
      pathname +
      (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    window.gtag("event", "page_view", {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, searchParams, measurementId]);

  if (!measurementId) return <>{children}</>;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', '${measurementId}', { send_page_view: false });
      `}</Script>
      {children}
    </>
  );
}
