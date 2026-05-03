// Drives `object-position` for any <img>/<Image> that uses `object-cover`,
// keeping the focal point (typically the face center) in frame regardless of
// container aspect ratio. Sceneify normalizes focalPoint.x/y to 0–1 against
// the image's natural dimensions, which is exactly what CSS expects.
export type FocalPointLike = {
  x: number;
  y: number;
} | null | undefined;

export type FaceBoxLike = {
  x: number;
  y: number;
  width: number;
  height: number;
} | null | undefined;

export function focalToObjectPosition(focal: FocalPointLike): string {
  if (!focal) return "50% 50%";
  const x = clamp01(focal.x) * 100;
  const y = clamp01(focal.y) * 100;
  return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
}

// Computes object-position for `object-cover` so that the entire faceBox stays
// inside the visible viewport. Within the valid range, picks the position
// closest to the focal point so framing still looks intentional. Falls back to
// focal-only when faceBox or aspect ratios are unavailable.
export function faceSafeObjectPosition(input: {
  faceBox?: FaceBoxLike;
  focalPoint?: FocalPointLike;
  naturalAspect?: number;
  containerAspect?: number;
}): string {
  const { faceBox, focalPoint, naturalAspect, containerAspect } = input;
  if (
    !naturalAspect ||
    !containerAspect ||
    !Number.isFinite(naturalAspect) ||
    !Number.isFinite(containerAspect)
  ) {
    return focalToObjectPosition(focalPoint);
  }

  // Visible source fraction per axis under object-cover. The axis with the
  // more "extreme" aspect mismatch is the one that gets cropped (fraction < 1).
  let visibleFracX: number;
  let visibleFracY: number;
  if (naturalAspect > containerAspect) {
    visibleFracX = containerAspect / naturalAspect;
    visibleFracY = 1;
  } else {
    visibleFracX = 1;
    visibleFracY = naturalAspect / containerAspect;
  }

  const tx = solveAxis(
    1 - visibleFracX,
    visibleFracX,
    faceBox?.x,
    faceBox?.width,
    focalPoint?.x,
  );
  const ty = solveAxis(
    1 - visibleFracY,
    visibleFracY,
    faceBox?.y,
    faceBox?.height,
    focalPoint?.y,
  );

  return `${(tx * 100).toFixed(2)}% ${(ty * 100).toFixed(2)}%`;
}

function solveAxis(
  slack: number,
  visibleFrac: number,
  faceMin: number | undefined,
  faceSize: number | undefined,
  focal: number | undefined,
): number {
  if (slack <= 1e-6) return 0.5;
  let tMin = 0;
  let tMax = 1;
  if (faceMin !== undefined && faceSize !== undefined && faceSize > 0) {
    tMin = Math.max(0, (faceMin + faceSize - visibleFrac) / slack);
    tMax = Math.min(1, faceMin / slack);
    if (tMin > tMax) {
      return clamp01((faceMin + faceSize / 2 - visibleFrac / 2) / slack);
    }
  }
  const tFocal = focal !== undefined ? (focal - visibleFrac / 2) / slack : 0.5;
  return clamp01(Math.min(tMax, Math.max(tMin, tFocal)));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
