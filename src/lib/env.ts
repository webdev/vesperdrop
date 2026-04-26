import "server-only";
import { z } from "zod";

const bool = z
  .union([z.literal("true"), z.literal("false")])
  .transform((v) => v === "true");

const ServerEnv = z.object({
  // Sceneify
  SCENEIFY_API_URL: z.string().url(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_PRO_PRICE_ID: z.string().min(1),

  // Plan config
  PLAN_FREE_MONTHLY_GENERATIONS: z.coerce.number().int().nonnegative(),
  PLAN_FREE_WATERMARK: bool,
  PLAN_PRO_PRICE_USD: z.coerce.number().nonnegative(),
  PLAN_PRO_MONTHLY_GENERATIONS: z.coerce.number().int().nonnegative(),
  PLAN_PRO_WATERMARK: bool,

  // Throughput guards
  MAX_RUN_IMAGES: z.coerce.number().int().positive(),
  RUNS_PER_MINUTE_PER_USER: z.coerce.number().int().positive(),

  // Vercel Blob (optional locally)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

export const env = ServerEnv.parse(process.env);
