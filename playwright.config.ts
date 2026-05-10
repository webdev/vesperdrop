import { defineConfig } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import path from "node:path";

// Load .env.e2e (gitignored) so the dev server we spawn for the e2e
// suite gets the local Supabase keys + mock toggles. .env.e2e.example
// documents what keys to fill in; values come from `pnpm db:status`
// once `pnpm db:start` has the local stack running.
loadDotenv({ path: path.join(__dirname, ".env.e2e") });

function envOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name} in .env.e2e. Copy .env.e2e.example to .env.e2e and fill in the local Supabase keys from \`pnpm db:status\`.`,
    );
  }
  return value;
}

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    // Run on a separate port so we don't fight a developer's `pnpm dev`
    // on :3000 (which is wired to production Supabase). The freemium
    // funnel e2e needs the local Supabase + Mailpit stack from
    // `pnpm db:start`.
    command: "pnpm exec next dev --port 3001",
    port: 3001,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      E2E_SCENEIFY_MOCK: process.env.E2E_SCENEIFY_MOCK ?? "1",
      SCENEIFY_API_URL:
        process.env.SCENEIFY_API_URL ?? "http://localhost:3001",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: envOrThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: envOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_e2estub",
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "sk_test_e2estub",
      STRIPE_WEBHOOK_SECRET:
        process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_e2estub",
      STRIPE_PRO_PRICE_ID:
        process.env.STRIPE_PRO_PRICE_ID ?? "price_e2estub",
      PLAN_FREE_MONTHLY_GENERATIONS:
        process.env.PLAN_FREE_MONTHLY_GENERATIONS ?? "10",
      PLAN_FREE_WATERMARK: process.env.PLAN_FREE_WATERMARK ?? "true",
      PLAN_PRO_PRICE_USD: process.env.PLAN_PRO_PRICE_USD ?? "49",
      PLAN_PRO_MONTHLY_GENERATIONS:
        process.env.PLAN_PRO_MONTHLY_GENERATIONS ?? "200",
      PLAN_PRO_WATERMARK: process.env.PLAN_PRO_WATERMARK ?? "false",
      MAX_RUN_IMAGES: process.env.MAX_RUN_IMAGES ?? "60",
      RUNS_PER_MINUTE_PER_USER:
        process.env.RUNS_PER_MINUTE_PER_USER ?? "3",
      POSTGRES_URL:
        process.env.POSTGRES_URL ??
        "postgres://postgres:postgres@127.0.0.1:54322/postgres",
    },
  },
  use: { baseURL: "http://localhost:3001" },
});
