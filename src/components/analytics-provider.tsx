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
 * Also loads Google Tag Manager so non-engineering tags (Contentsquare,
 * Hotjar, ad pixels, etc.) can be configured from the GTM UI without
 * code changes. GTM's own `dataLayer` listener handles SPA route
 * changes; no manual wiring is needed.
 *
 * Each integration no-ops cleanly when its env var is unset; both can
 * coexist or run independently.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const measurementId = clientEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const gtmId = clientEnv.NEXT_PUBLIC_GTM_ID;

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

  if (!measurementId && !gtmId) return <>{children}</>;

  return (
    <>
      {measurementId ? (
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
        </>
      ) : null}
      {gtmId ? (
        <>
          <Script id="gtm-init" strategy="afterInteractive">{`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${gtmId}');
      `}</Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      ) : null}
      {children}
    </>
  );
}
