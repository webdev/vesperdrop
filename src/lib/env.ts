import "server-only";
import { z } from "zod";
import { clientEnv } from "./env.client";

const bool = z
  .union([z.literal("true"), z.literal("false")])
  .transform((v) => v === "true");

const optionalBool = z
  .union([z.literal("true"), z.literal("false")])
  .optional()
  .transform((v) => v === "true");

const ServerOnlyEnv = z.object({
  SITE_URL: z.string().url().default("https://vesperdrop.com"),
  SITE_PUBLIC: optionalBool,
  SCENEIFY_API_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_STARTER_PRICE_ID: z.string().min(1),
  STRIPE_PRO_PRICE_ID: z.string().min(1),
  STRIPE_STUDIO_PRICE_ID: z.string().min(1),
  STRIPE_AGENCY_PRICE_ID: z.string().min(1),
  PLAN_FREE_MONTHLY_GENERATIONS: z.coerce.number().int().nonnegative(),
  PLAN_FREE_WATERMARK: bool,
  PLAN_PRO_PRICE_USD: z.coerce.number().nonnegative(),
  PLAN_PRO_MONTHLY_GENERATIONS: z.coerce.number().int().nonnegative(),
  PLAN_PRO_WATERMARK: bool,
  MAX_RUN_IMAGES: z.coerce.number().int().positive(),
  RUNS_PER_MINUTE_PER_USER: z.coerce.number().int().positive(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  FAL_KEY: z.string().optional().default(""),
  POSTGRES_URL: z.string().url(),
});

export const env = { ...ServerOnlyEnv.parse(process.env), ...clientEnv };
