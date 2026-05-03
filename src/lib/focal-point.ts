// Drives `object-position` for any <img>/<Image> that uses `object-cover`,
// keeping the focal point (typically the face center) in frame regardless of
// container aspect ratio. Sceneify normalizes focalPoint.x/y to 0–1 against
// the image's natural dimensions, which is exactly what CSS expects.
//
// CSS clamps automatically — a focal at (0.5, 0.05) on a square crop just
// pins the top edge; we don't need per-aspect math.
export type FocalPointLike = {
  x: number;
  y: number;
} | null | undefined;

export function focalToObjectPosition(focal: FocalPointLike): string {
  if (!focal) return "50% 50%";
  const x = clamp01(focal.x) * 100;
  const y = clamp01(focal.y) * 100;
  return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
