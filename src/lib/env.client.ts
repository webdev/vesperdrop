import { z } from "zod";

const ClientEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
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
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
});

export const isNonProdEnv = clientEnv.NEXT_PUBLIC_VERCEL_ENV !== "production";
