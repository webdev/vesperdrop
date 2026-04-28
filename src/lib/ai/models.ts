/**
 * AI model catalog — single source of truth for model IDs, costs, and routing.
 * All generation goes through lib/ai/generate.ts. Never import fal-ai directly from routes.
 */

/** fal.ai model endpoint IDs */
export const FAL_MODELS = {
  /** Flux Schnell — 4-step text-to-image, ~3s, $0.003. For text-only fast previews. */
  FLUX_SCHNELL: "fal-ai/flux/schnell",
  /** Flux Dev — image-to-image via image_url, 8 steps for preview quality. ~10s, ~$0.025. */
  FLUX_DEV: "fal-ai/flux/dev",
  /** Flux 1.1 Pro — high-quality image-to-image, 28 steps, full res. ~25s, $0.04. */
  FLUX_PRO: "fal-ai/flux-pro/v1.1",
} as const;

export type FalModelId = (typeof FAL_MODELS)[keyof typeof FAL_MODELS];

/** Approximate cost per image in USD */
export const MODEL_COST_USD: Record<string, number> = {
  [FAL_MODELS.FLUX_SCHNELL]: 0.003,
  [FAL_MODELS.FLUX_DEV]: 0.025,
  [FAL_MODELS.FLUX_PRO]: 0.04,
};

/** Credits consumed per image by quality tier. 1 credit = 1 HD image. */
export const QUALITY_CREDIT_COST: Record<"preview" | "hd", number> = {
  preview: 0, // previews are free (watermarked)
  hd: 1,
};

/** Monthly credit allocation per subscription plan (refilled by Stripe webhook) */
export const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  free: 0,       // no monthly refill; signs up with 1 credit
  starter: 50,
  pro: 200,
  studio: 1000,
  agency: 5000,
};

/** Route to the correct fal.ai model based on desired quality */
export function routeModel(quality: "preview" | "hd"): FalModelId {
  return quality === "hd" ? FAL_MODELS.FLUX_PRO : FAL_MODELS.FLUX_DEV;
}
