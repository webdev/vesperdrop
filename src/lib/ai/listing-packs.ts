import type { SceneifyPackPlatform } from "@/lib/ai/sceneify";

/**
 * UI-side metadata mirror of the Sceneify listing pack catalog.
 * Used to render the platform picker and price the credit cost.
 * Prompts and shot framings stay Sceneify-side.
 */
export interface ListingPackMeta {
  platform: SceneifyPackPlatform;
  label: string;
  shots: number;
  hint: string;
  /** Roles in the order Sceneify will return them. Display only. */
  roles: string[];
}

export const LISTING_PACK_META: Record<SceneifyPackPlatform, ListingPackMeta> = {
  amazon: {
    platform: "amazon",
    label: "Amazon Apparel",
    shots: 6,
    hint: "1 main + 3 lifestyle + 2 detail · 2048²",
    roles: ["Hero", "Three-quarter", "Profile", "Full body", "Detail · hardware", "Detail · fabric"],
  },
  shopify: {
    platform: "shopify",
    label: "Shopify lookbook",
    shots: 4,
    hint: "1 hero + 3 supporting",
    roles: ["Hero", "Three-quarter", "Full body", "Hero banner"],
  },
  instagram: {
    platform: "instagram",
    label: "Instagram set",
    shots: 5,
    hint: "1:1 + carousel",
    roles: ["Hero", "Carousel 1", "Carousel 2", "Carousel 3", "Carousel 4"],
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok Reels",
    shots: 3,
    hint: "9:16 vertical",
    roles: ["Cover", "Beat 1", "Beat 2"],
  },
};

export function isPackPlatform(value: string): value is SceneifyPackPlatform {
  return value in LISTING_PACK_META;
}

export function packCreditCost(platform: SceneifyPackPlatform): number {
  return LISTING_PACK_META[platform].shots;
}
