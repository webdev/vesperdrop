import "server-only";
import { sceneify } from "@/lib/sceneify/client";
import type { SceneifyPublicPreset } from "@/lib/sceneify/types";

export type IgSlotType = "lifestyle_hero" | "storefront" | "detail";

export const IG_SLOT_LABEL: Record<IgSlotType, string> = {
  lifestyle_hero: "Lifestyle hero",
  storefront: "Full shot",
  detail: "Texture detail",
};

export const IG_SLOT_ASPECT: Record<
  IgSlotType,
  "portrait" | "square" | "landscape"
> = {
  lifestyle_hero: "portrait",
  storefront: "square",
  detail: "landscape",
};

export const IG_SLOT_PRIORITY: IgSlotType[] = [
  "lifestyle_hero",
  "storefront",
  "detail",
];

const FALLBACKS: Record<IgSlotType, string[]> = {
  lifestyle_hero: ["cozy-indoor", "outdoor", "golden-hour"],
  storefront: ["studio-clean"],
  detail: ["studio-clean", "cozy-indoor"],
};

function classify(preset: SceneifyPublicPreset): IgSlotType[] {
  const cat = (preset.category ?? "").toLowerCase();
  const mood = (preset.mood ?? "").toLowerCase();
  const name = (preset.name ?? "").toLowerCase();
  const slug = (preset.slug ?? "").toLowerCase();
  const blob = `${cat} ${mood} ${name} ${slug}`;

  const slots: IgSlotType[] = [];

  const isStudio =
    /studio|clean|product|catalog|ecommerce|white|seamless/.test(blob);
  const isLifestyle =
    /lifestyle|cozy|outdoor|indoor|golden|cinematic|editorial|hero|natural|home|cafe|street/.test(
      blob,
    );
  const isDetail =
    /detail|texture|macro|close.?up|crop|surface|fabric|grain|graffiti|alley/.test(
      blob,
    );

  if (isLifestyle) slots.push("lifestyle_hero");
  if (isStudio) slots.push("storefront");
  if (isDetail) slots.push("detail");

  if (slots.length === 0) {
    slots.push("lifestyle_hero");
  }
  return slots;
}

let _catalogPromise: Promise<SceneifyPublicPreset[]> | null = null;

async function getCatalog(): Promise<SceneifyPublicPreset[]> {
  if (!_catalogPromise) {
    _catalogPromise = sceneify()
      .listPublicPresets()
      .catch((e) => {
        _catalogPromise = null;
        throw e;
      });
  }
  return _catalogPromise;
}

async function poolForSlot(slot: IgSlotType): Promise<string[]> {
  const catalog = await getCatalog();
  const slugs = new Set<string>();
  for (const p of catalog) {
    const matches = classify(p);
    if (matches.includes(slot)) slugs.add(p.slug);
  }
  if (slugs.size === 0) {
    const allowed = new Set(catalog.map((p) => p.slug));
    for (const fb of FALLBACKS[slot]) {
      if (allowed.has(fb)) slugs.add(fb);
    }
  }
  if (slugs.size === 0) {
    return catalog.map((p) => p.slug);
  }
  return Array.from(slugs);
}

export async function pickPresetForSlot(
  slot: IgSlotType,
  excludeSlugs: Set<string>,
): Promise<string> {
  const pool = await poolForSlot(slot);
  const fresh = pool.filter((s) => !excludeSlugs.has(s));
  const candidates = fresh.length > 0 ? fresh : pool;
  if (candidates.length === 0) {
    return FALLBACKS[slot][0] ?? "studio-clean";
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
