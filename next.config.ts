import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Inline the page's critical CSS into the HTML <head> so the browser can
  // paint LCP without waiting on a render-blocking external stylesheet.
  // Next 16 native flag — no critters/beasties dep. (VES-7 LCP fix.)
  experimental: {
    inlineCss: true,
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8080" },
      { protocol: "http", hostname: "127.0.0.1", port: "8080" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "i.etsystatic.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/etsy-preview/:token",
        destination: "/p/:token",
        permanent: true,
      },
    ];
  },
};

export default withWorkflow(nextConfig);
