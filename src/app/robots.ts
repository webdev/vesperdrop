import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

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
        disallow: ["/api/", "/account", "/app", "/mfa-verify", "/unauthorized"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
