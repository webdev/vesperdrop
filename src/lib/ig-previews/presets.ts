import type { IgSlotType } from "./slot-types";

export function pickRandomPresets(slugs: string[], count: number): string[] {
  if (slugs.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(slugs[Math.floor(Math.random() * slugs.length)]);
  }
  return out;
}

export type PlannedSlot = { sourceIndex: number; slotType: IgSlotType };

export type GenerationPlan = {
  outputs: PlannedSlot[];
  totalCount: number;
  perImage: number;
  description: string;
};

export function planGeneration(sourceCount: number): GenerationPlan {
  if (sourceCount <= 0) {
    return { outputs: [], totalCount: 0, perImage: 0, description: "no sources" };
  }
  if (sourceCount === 1) {
    const outputs: PlannedSlot[] = [
      { sourceIndex: 0, slotType: "lifestyle_hero" },
      { sourceIndex: 0, slotType: "storefront" },
      { sourceIndex: 0, slotType: "detail" },
    ];
    return {
      outputs,
      totalCount: 3,
      perImage: 3,
      description: "hero + storefront + detail",
    };
  }
  const outputs: PlannedSlot[] = [];
  for (let s = 0; s < sourceCount; s += 1) {
    outputs.push({ sourceIndex: s, slotType: "lifestyle_hero" });
    outputs.push({ sourceIndex: s, slotType: "storefront" });
  }
  return {
    outputs,
    totalCount: outputs.length,
    perImage: 2,
    description: "2 per image (hero + storefront)",
  };
}
