import "server-only";

export type PreviewSlotKey = "hero" | "lifestyle" | "detail";

/**
 * Sceneify preset pools per slot, picked randomly per generation. Each
 * slot is biased toward a role (clean Shopify hero, lifestyle context,
 * intimate detail). Slugs come from sceneify().listPublicPresets() —
 * confirm against staging before adding new ones.
 *
 * Override per-slot with the environment to pin a specific slug:
 *   ETSY_PRESET_HERO=studio-clean
 *   ETSY_PRESET_LIFESTYLE=outdoor
 *   ETSY_PRESET_DETAIL=cozy-indoor
 */
// Both 'hero' and 'lifestyle' draw from lifestyle presets — sellers
// respond more to on-scene model imagery than to clean studio shots,
// so the AFTER collage is mostly people-in-context with one
// closeup/texture detail. 'studio-clean' is kept in the hero pool as
// a small minority for variety.
const POOLS: Record<PreviewSlotKey, string[]> = {
  hero: ["cozy-indoor", "outdoor", "golden-hour", "studio-clean"],
  lifestyle: ["cozy-indoor", "outdoor", "golden-hour"],
  detail: ["studio-clean", "cozy-indoor", "graffiti-alley"],
};

export const PREVIEW_SLOTS: PreviewSlotKey[] = ["hero", "lifestyle", "detail"];

export function pickPresetForSlot(slot: PreviewSlotKey): string {
  const override = process.env[`ETSY_PRESET_${slot.toUpperCase()}`];
  if (override && override.length > 0) return override;
  const pool = POOLS[slot];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickPresetsForAllSlots(): Record<PreviewSlotKey, string> {
  return {
    hero: pickPresetForSlot("hero"),
    lifestyle: pickPresetForSlot("lifestyle"),
    detail: pickPresetForSlot("detail"),
  };
}
