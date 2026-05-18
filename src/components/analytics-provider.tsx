"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { clientEnv } from "@/lib/env.client";

/**
 * Loads gtag.js for Google Analytics 4 and Meta Pixel. All third-party
 * scripts use `strategy="lazyOnload"` so they only fire after the page
 * has reached `window.load`, keeping initial paint + TTI uncluttered.
 *
 * Trade-off: the React `useEffect` that manually fires `gtag` page_view
 * on route change runs before the scripts load, so for the very first
 * page view we rely on gtag's own `send_page_view: true` config-time
 * fire (and Meta Pixel's inline `fbq('track','PageView')` at load).
 * Subsequent SPA route changes are caught by the useEffect because
 * `gtag` / `fbq` exist on `window` by then.
 *
 * Also loads Google Tag Manager so non-engineering tags (Contentsquare,
 * etc.) can be configured from the GTM UI. GTM's own dataLayer listener
 * handles SPA route changes; no manual wiring is needed.
 *
 * Each integration no-ops cleanly when its env var is unset.
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (!fbq) return;
    fbq("track", "PageView");
  }, [pathname, searchParams]);

  return (
    <>
      <Script id="hotjar-init" strategy="lazyOnload">{`
        (function(h,o,t,j,a,r){
          h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
          h._hjSettings={hjid:6708367,hjsv:6};
          a=o.getElementsByTagName('head')[0];
          r=o.createElement('script');r.async=1;
          r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
          a.appendChild(r);
        })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
      `}</Script>
      <Script id="meta-pixel-init" strategy="lazyOnload">{`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '1565661798604143');
        fbq('track', 'PageView');
      `}</Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src="https://www.facebook.com/tr?id=1565661798604143&ev=PageView&noscript=1"
          alt=""
        />
      </noscript>
      {measurementId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="lazyOnload"
          />
          <Script id="ga-init" strategy="lazyOnload">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', '${measurementId}', { send_page_view: true });
      `}</Script>
        </>
      ) : null}
      {gtmId ? (
        <>
          <Script id="gtm-init" strategy="lazyOnload">{`
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
