import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: true,
    env: {
      E2E_SCENEIFY_MOCK: "1",
      SCENEIFY_API_URL: "http://localhost:3000",
      // Minimal stubs so Zod env schemas pass during e2e runs without a real .env.local
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-stub-anon-key",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_e2estub",
      SUPABASE_SERVICE_ROLE_KEY: "e2e-stub-service-role-key",
      STRIPE_SECRET_KEY: "sk_test_e2estub",
      STRIPE_WEBHOOK_SECRET: "whsec_e2estub",
      STRIPE_PRO_PRICE_ID: "price_e2estub",
      PLAN_FREE_MONTHLY_GENERATIONS: "10",
      PLAN_FREE_WATERMARK: "true",
      PLAN_PRO_PRICE_USD: "49",
      PLAN_PRO_MONTHLY_GENERATIONS: "200",
      PLAN_PRO_WATERMARK: "false",
      MAX_RUN_IMAGES: "60",
      RUNS_PER_MINUTE_PER_USER: "3",
      POSTGRES_URL: "postgres://e2e:e2e@127.0.0.1:54322/postgres",
    },
  },
  use: { baseURL: "http://localhost:3000" },
});
