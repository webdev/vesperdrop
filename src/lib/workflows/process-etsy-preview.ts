import "server-only";
import { generateViaSceneify } from "@/lib/ai/sceneify";
import { snapshotEtsyImage } from "@/lib/etsy-outreach/snapshot";
import {
  PREVIEW_SLOTS,
  pickPresetsForAllSlots,
  type PreviewSlotKey,
} from "@/lib/etsy-outreach/presets";
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

async function pickPresets(): Promise<Record<PreviewSlotKey, string>> {
  "use step";
  return pickPresetsForAllSlots();
}

/**
 * Inspect the current preview row and return the list of slot keys that
 * still need work (anything not already 'succeeded'). On a fresh
 * generate this is all three slots; on a partial-row retry it's just
 * the slots that failed previously, so successful generations are
 * preserved.
 */
async function slotsNeedingWork(pageId: string): Promise<PreviewSlotKey[]> {
  "use step";
  const page = await getPreviewById(pageId);
  if (!page) return [];
  const out: PreviewSlotKey[] = [];
  if (page.heroStatus !== "succeeded") out.push("hero");
  if (page.lifestyleStatus !== "succeeded") out.push("lifestyle");
  if (page.detailStatus !== "succeeded") out.push("detail");
  return out;
}

async function generateOneSlot(
  pageId: string,
  sourceUrl: string,
  slot: PreviewSlotKey,
  presetSlug: string,
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

    // First attempt: gpt-image-2 (best quality, slow). Sceneify's Vercel
    // function frequently 502s on this model under concurrent load.
    let result;
    try {
      result = await generateViaSceneify({
        sourceUrl,
        presetSlug,
        model: "gpt-image-2",
        quality: "medium",
        callerRef: `etsy-preview:${pageId}:${slot}`,
        priority: "outreach",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isRetriable =
        /sceneify\s+5\d{2}/i.test(message) ||
        /timeout|timed?\s*out|abort/i.test(message);
      if (!isRetriable) throw e;
      // Brief pause to let Sceneify recover, then retry with a faster
      // model. nano-banana-2 typically completes in 10–20s vs 45–90s
      // for gpt-image-2, well inside Sceneify's function timeout.
      await new Promise((r) => setTimeout(r, 2000));
      result = await generateViaSceneify({
        sourceUrl,
        presetSlug,
        model: "nano-banana-2",
        quality: "medium",
        callerRef: `etsy-preview:${pageId}:${slot}:retry`,
        priority: "outreach",
      });
    }
    await setSlotResult(pageId, slot, {
      url: result.outputUrl,
      focalPoint: result.focalPoint ?? null,
      faceBox: result.faceBox ?? null,
    });
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
  if (
    page &&
    (finalStatus === "completed" ||
      finalStatus === "partial" ||
      finalStatus === "failed")
  ) {
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
    const slots = await slotsNeedingWork(pageId);
    if (slots.length > 0) {
      const picks = await pickPresets();
      await Promise.all(
        slots.map((slot) =>
          generateOneSlot(pageId, sourceUrl, slot, picks[slot], mock),
        ),
      );
    }
  }

  await finalize(pageId);
}
