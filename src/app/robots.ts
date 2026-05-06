import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * robots.txt
 *
 * Public production must have SITE_PUBLIC=true in Vercel env. When
 * SITE_PUBLIC is unset/false the whole site is disallowed (use this for
 * preview/staging deployments). When public, marketing routes are allowed
 * and authenticated/auth surfaces are disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.SITE_URL.replace(/\/$/, "");

  if (!env.SITE_PUBLIC) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/account",
          "/app",
          "/sign-in",
          "/sign-up",
          "/mfa-verify",
          "/unauthorized",
          "/admin",
          "/etsy-preview",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
