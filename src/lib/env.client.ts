import { z } from "zod";

const ClientEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  // Google Analytics 4 measurement id (e.g. "G-XXXXXXXXXX"). When unset,
  // the AnalyticsProvider skips loading gtag.js and track() is a no-op.
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().min(1).optional(),
  // Google Tag Manager container id (e.g. "GTM-XXXXXXX"). Used as the
  // single entry point for non-engineering tags — Contentsquare, Hotjar,
  // ad pixels, etc. — configured in the GTM UI rather than in code.
  // When unset, the AnalyticsProvider skips loading GTM entirely.
  NEXT_PUBLIC_GTM_ID: z.string().min(1).optional(),
  // Auto-set by Vercel: "production" | "preview" | "development". Unset in
  // pure local `pnpm dev`. Used to scope dev-only affordances (e.g. the
  // mock-gen pill) to non-prod environments without manual configuration.
  NEXT_PUBLIC_VERCEL_ENV: z
    .enum(["production", "preview", "development"])
    .optional(),
});

// In deployed environments NEXT_PUBLIC_SUPABASE_URL is injected by the
// Vercel-Supabase Marketplace integration as the bare *.supabase.co URL,
// which then leaks onto the Google OAuth consent screen. We've enabled
// Supabase Custom Domains so https://auth.vesperdrop.com points at the
// same project — rewrite the URL here so every Supabase client (browser,
// server, middleware, admin) routes through our own domain. Local dev
// (e.g. http://127.0.0.1:54321) is unaffected.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.endsWith(
  ".supabase.co",
)
  ? "https://auth.vesperdrop.com"
  : process.env.NEXT_PUBLIC_SUPABASE_URL;

export const clientEnv = ClientEnv.parse({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
});

export const isNonProdEnv = clientEnv.NEXT_PUBLIC_VERCEL_ENV !== "production";
