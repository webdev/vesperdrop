import "server-only";
import { falQueue } from "./fal";
import { routeModel, type FalModelId } from "./models";

/** Minimal scene data needed for prompt construction */
export type GenerationScene = {
  slug: string;
  name: string;
  mood: string;
  category: string;
  imageUrl: string; // used as first reference image in MVP
};

export type GenerationOptions = {
  quality: "preview" | "hd";
  /** Public URL of the user's uploaded product image */
  sourceImageUrl: string;
  scene: GenerationScene;
  /** Optional pre-picked reference images (defaults to scene hero only) */
  referenceImageUrls?: string[];
};

export type GenerationResult = {
  outputUrl: string;
  modelUsed: FalModelId;
  seed?: number;
};

/** Placeholder returned when FAL_KEY is absent (local dev without API key) */
export const DEV_PLACEHOLDER_URL =
  "https://placehold.co/1024x1024/1b1915/f4f0e8?text=VERCELDROP+DEV";

function buildPrompt(scene: GenerationScene, refCount: number): string {
  return [
    "Professional lifestyle photography of a fashion/clothing product.",
    `Scene: ${scene.name}. Mood: ${scene.mood}. Style: ${scene.category}.`,
    "A model wearing or interacting with the product in an authentic lifestyle setting.",
    "Editorial quality, magazine-grade photography, sharp details, natural lighting.",
    refCount > 0
      ? `Consistent aesthetic inspired by ${refCount} curated reference images.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Generate one lifestyle image. Call from within a workflow step. */
export async function generateImage(opts: GenerationOptions): Promise<GenerationResult> {
  const { FAL_KEY } = await import("@/lib/env").then((m) => ({ FAL_KEY: m.env.FAL_KEY }));

  // Dev fallback — simulate latency, return placeholder
  if (!FAL_KEY) {
    await new Promise((r) => setTimeout(r, opts.quality === "hd" ? 2000 : 1000));
    return { outputUrl: DEV_PLACEHOLDER_URL, modelUsed: routeModel(opts.quality) };
  }

  const modelId = routeModel(opts.quality);
  const isHd = opts.quality === "hd";
  const refs = opts.referenceImageUrls ?? [opts.scene.imageUrl];
  const prompt = buildPrompt(opts.scene, refs.length);

  const result = await falQueue(modelId, {
    prompt,
    image_url: opts.sourceImageUrl,
    strength: isHd ? 0.8 : 0.85,
    image_size: isHd ? "square_hd" : "landscape_4_3",
    num_images: 1,
    num_inference_steps: isHd ? 28 : 8,
    enable_safety_checker: false,
  });

  const image = result.images?.[0];
  if (!image?.url) throw new Error("fal.ai returned no image URL");

  return { outputUrl: image.url, modelUsed: modelId, seed: result.seed };
}
