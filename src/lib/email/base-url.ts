import { env } from "@/lib/env";

/**
 * Base URL for links embedded in transactional emails (e.g. the
 * "Generate more" / batch link in the watermark-free photo email).
 *
 * Preview deploys link back to the preview deployment so a test email
 * lands on the same environment that generated it; production uses the
 * canonical SITE_URL. SEO/metadata URLs (sitemap, robots, layout
 * metadataBase, structured data) intentionally keep using env.SITE_URL
 * and must NOT use this — they always point at prod.
 *
 * On Vercel, VERCEL_ENV is "preview" | "production"; VERCEL_BRANCH_URL /
 * VERCEL_URL are the deployment host (no protocol). Prefer the branch
 * alias (stable across redeploys of the same branch), fall back to the
 * immutable per-deployment URL, then to SITE_URL (prod / local).
 */
export function emailLinkBaseUrl(): string {
  if (process.env.VERCEL_ENV === "preview") {
    const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
    if (host) return `https://${host.replace(/\/+$/, "")}`;
  }
  return env.SITE_URL.replace(/\/+$/, "");
}
