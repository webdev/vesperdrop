import "server-only";

export type PreviewSlotKey = "hero" | "lifestyle" | "detail";

/**
 * Pinned Sceneify preset slugs for the three preview slots. These are
 * placeholders — before going live, run sceneify().listPresets() against
 * the staging API and update with the real slug names that read as
 * "Shopify hero", "lifestyle", "product detail". Either set the env
 * overrides or update the constants here.
 */
export const ETSY_PRESETS: Record<PreviewSlotKey, string> = {
  hero: process.env.ETSY_PRESET_HERO ?? "shopify-hero",
  lifestyle: process.env.ETSY_PRESET_LIFESTYLE ?? "lifestyle",
  detail: process.env.ETSY_PRESET_DETAIL ?? "detail",
};

export const PREVIEW_SLOTS: PreviewSlotKey[] = ["hero", "lifestyle", "detail"];
