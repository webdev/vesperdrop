import "server-only";
import { generateViaSceneify } from "@/lib/ai/sceneify";
import { snapshotEtsyImage } from "@/lib/etsy-outreach/snapshot";
import { ETSY_PRESETS, PREVIEW_SLOTS, type PreviewSlotKey } from "@/lib/etsy-outreach/presets";
import {
  finalizePreviewStatus,
  getPreviewById,
  setSlotResult,
  setSlotRunning,
  updatePreviewSourceBlob,
} from "@/lib/etsy-outreach/pages";
import { setCandidateStatus } from "@/lib/etsy-outreach/candidates";

async function loadAndSnapshot(pageId: string): Promise<string | null> {
  "use step";
  const page = await getPreviewById(pageId);
  if (!page) throw new Error(`preview ${pageId} not found`);
  const sourceUrl = page.listingSnapshot.imageUrl;
  if (!sourceUrl) {
    return null; // candidate had no image; treat as failed in caller
  }
  if (page.sourceBlobUrl) return page.sourceBlobUrl;
  const blobUrl = await snapshotEtsyImage(sourceUrl, pageId);
  await updatePreviewSourceBlob(pageId, blobUrl);
  return blobUrl;
}

async function generateOneSlot(
  pageId: string,
  sourceUrl: string,
  slot: PreviewSlotKey,
  mock: boolean,
): Promise<void> {
  "use step";
  await setSlotRunning(pageId, slot);
  try {
    if (mock) {
      await new Promise((r) => setTimeout(r, 8000 + Math.random() * 4000));
      await setSlotResult(pageId, slot, { url: sourceUrl });
      return;
    }
    const result = await generateViaSceneify({
      sourceUrl,
      presetSlug: ETSY_PRESETS[slot],
      model: "gpt-image-2",
      quality: "high",
      callerRef: `etsy-preview:${pageId}:${slot}`,
    });
    await setSlotResult(pageId, slot, { url: result.outputUrl });
  } catch (e) {
    await setSlotResult(pageId, slot, {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function failAllSlots(pageId: string, message: string): Promise<void> {
  "use step";
  for (const slot of PREVIEW_SLOTS) {
    await setSlotResult(pageId, slot, { error: message });
  }
}

async function finalize(pageId: string): Promise<void> {
  "use step";
  const finalStatus = await finalizePreviewStatus(pageId);
  const page = await getPreviewById(pageId);
  if (page) {
    await setCandidateStatus(page.candidateId, finalStatus);
  }
}

export async function processEtsyPreview(
  pageId: string,
  mock = false,
): Promise<void> {
  "use workflow";

  const sourceUrl = await loadAndSnapshot(pageId);
  if (!sourceUrl) {
    await failAllSlots(pageId, "no source image on candidate");
  } else {
    await Promise.all(
      PREVIEW_SLOTS.map((slot) => generateOneSlot(pageId, sourceUrl, slot, mock)),
    );
  }

  await finalize(pageId);
}
