import "server-only";
import { generateViaSceneify } from "@/lib/ai/sceneify";
import {
  appendIgPreviewOutput,
  getIgPreviewById,
  setIgPreviewStatus,
} from "@/lib/ig-previews/pages";
import { planGeneration } from "@/lib/ig-previews/presets";
import {
  pickPresetForSlot,
  type IgSlotType,
} from "@/lib/ig-previews/slot-types";

type SlotPlan = {
  index: number;
  sourceIndex: number;
  slotType: IgSlotType;
  presetSlug: string;
};

type PreferredSlot = {
  sourceIndex: number;
  slotType: IgSlotType;
  presetSlug?: string;
};

async function loadAndPlan(
  previewId: string,
  preferredSlots: PreferredSlot[] = [],
): Promise<{
  sourceUrls: string[];
  slots: SlotPlan[];
  expected: number;
} | null> {
  "use step";
  const row = await getIgPreviewById(previewId);
  if (!row) throw new Error(`ig preview ${previewId} not found`);
  const sources = row.sourceImages.map((s) => s.url);
  if (sources.length === 0) return null;

  const expected = row.expectedOutputCount;
  const start = row.outputs.length;
  if (start >= expected) {
    return { sourceUrls: sources, slots: [], expected };
  }

  const derived = planGeneration(sources.length).outputs;

  const usedSlugs = new Set<string>(
    row.outputs.map((o) => o.presetSlug).filter(Boolean),
  );

  const slots: SlotPlan[] = [];
  const queue = [...preferredSlots];
  for (let i = start; i < expected; i += 1) {
    const hint = queue.shift();
    let sourceIndex: number;
    let slotType: IgSlotType;
    let presetSlug: string;

    if (hint) {
      sourceIndex = hint.sourceIndex;
      slotType = hint.slotType;
      presetSlug =
        hint.presetSlug ?? (await pickPresetForSlot(slotType, usedSlugs));
    } else {
      const fallback = derived[i];
      if (!fallback) break;
      sourceIndex = fallback.sourceIndex;
      slotType = fallback.slotType;
      presetSlug = await pickPresetForSlot(slotType, usedSlugs);
    }

    if (sourceIndex >= sources.length) continue;
    usedSlugs.add(presetSlug);
    slots.push({ index: i, sourceIndex, slotType, presetSlug });
  }

  return { sourceUrls: sources, slots, expected };
}

async function generateOneSlot(
  previewId: string,
  sourceUrl: string,
  slot: SlotPlan,
  mock: boolean,
): Promise<boolean> {
  "use step";
  try {
    if (mock) {
      await new Promise((r) => setTimeout(r, 8000 + Math.random() * 4000));
      await appendIgPreviewOutput(previewId, {
        url: sourceUrl,
        sourceIndex: slot.sourceIndex,
        slotType: slot.slotType,
        presetSlug: slot.presetSlug,
        focalPoint: null,
        faceBox: null,
      });
      return true;
    }

    let result;
    try {
      result = await generateViaSceneify({
        sourceUrl,
        presetSlug: slot.presetSlug,
        model: "gpt-image-2",
        quality: "medium",
        callerRef: `ig-preview:${previewId}:${slot.index}`,
        priority: "outreach",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isRetriable =
        /sceneify\s+5\d{2}/i.test(message) ||
        /timeout|timed?\s*out|abort/i.test(message);
      if (!isRetriable) throw e;
      await new Promise((r) => setTimeout(r, 2000));
      result = await generateViaSceneify({
        sourceUrl,
        presetSlug: slot.presetSlug,
        model: "nano-banana-2",
        quality: "medium",
        callerRef: `ig-preview:${previewId}:${slot.index}:retry`,
        priority: "outreach",
      });
    }

    await appendIgPreviewOutput(previewId, {
      url: result.outputUrl,
      sourceIndex: slot.sourceIndex,
      slotType: slot.slotType,
      presetSlug: slot.presetSlug,
      focalPoint: result.focalPoint ?? null,
      faceBox: result.faceBox ?? null,
    });
    return true;
  } catch (e) {
    console.error(
      `[ig-preview] slot ${slot.index} failed:`,
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}

async function markGenerating(previewId: string): Promise<void> {
  "use step";
  await setIgPreviewStatus(previewId, "generating");
}

async function markFailed(previewId: string): Promise<void> {
  "use step";
  await setIgPreviewStatus(previewId, "failed", { completed: true });
}

async function finalize(previewId: string, expected: number): Promise<void> {
  "use step";
  const row = await getIgPreviewById(previewId);
  if (!row) return;
  const succeeded = row.outputs.length;
  let next: "completed" | "partial" | "failed";
  if (succeeded === 0) next = "failed";
  else if (succeeded >= expected) next = "completed";
  else next = "partial";
  await setIgPreviewStatus(previewId, next, { completed: true });
}

export async function processIgPreview(
  previewId: string,
  mock = false,
  preferredSlots: PreferredSlot[] = [],
): Promise<void> {
  "use workflow";

  const plan = await loadAndPlan(previewId, preferredSlots);
  if (!plan) {
    await markFailed(previewId);
    return;
  }

  await markGenerating(previewId);

  await Promise.all(
    plan.slots.map((slot) =>
      generateOneSlot(
        previewId,
        plan.sourceUrls[slot.sourceIndex],
        slot,
        mock,
      ),
    ),
  );

  await finalize(previewId, plan.expected);
}
