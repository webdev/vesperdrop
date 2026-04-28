/**
 * Reference image picker — MVP implementation.
 *
 * Randomly picks 3-5 reference images from a preset's catalog.
 * MVP: uses only the scene's hero image as the reference.
 *
 * v2 (month 1): VLM classifies the user's garment, pulls matching refs from catalog.
 * v3 (month 3): LoRA fine-tune per preset; zero extra inference cost at generation time.
 */

/**
 * Pick reference images for a scene.
 * @param candidateUrls - All available reference URLs for this preset/scene.
 * @param count - Number of references to pick (3-5 recommended).
 */
export function pickReferences(candidateUrls: string[], count = 4): string[] {
  if (candidateUrls.length === 0) return [];
  const n = Math.min(count, candidateUrls.length);
  // Fisher-Yates shuffle, take first n
  const arr = [...candidateUrls];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}
