import { describe, expect, it } from "vitest";
import { faceSafeObjectPosition, focalToObjectPosition } from "./focal-point";

describe("faceSafeObjectPosition", () => {
  it("falls back to focal when aspects unknown", () => {
    expect(
      faceSafeObjectPosition({ focalPoint: { x: 0.3, y: 0.4 } }),
    ).toBe(focalToObjectPosition({ x: 0.3, y: 0.4 }));
  });

  it("returns 50% 50% when no crop occurs (matching aspects)", () => {
    expect(
      faceSafeObjectPosition({
        naturalAspect: 1,
        containerAspect: 1,
        focalPoint: { x: 0.3, y: 0.4 },
      }),
    ).toBe("50.00% 50.00%");
  });

  it("anchors to face when focal would crop it (square container, tall portrait)", () => {
    // 4:5 source in 1:1 container, face high in frame. Without face-aware logic
    // a low focalPoint would happily crop the head; we should clamp the y to
    // keep the whole face visible.
    const pos = faceSafeObjectPosition({
      naturalAspect: 4 / 5,
      containerAspect: 1,
      faceBox: { x: 0.35, y: 0.05, width: 0.15, height: 0.25 },
      focalPoint: { x: 0.5, y: 0.9 },
    });
    // Vertical visible fraction = 0.8, slack = 0.2. tMax = 0.05/0.2 = 0.25.
    // Pull-toward-focal would try ty=(0.9-0.4)/0.2=2.5 → clamped to tMax=0.25.
    expect(pos).toBe("50.00% 25.00%");
  });

  it("centers face when face is larger than the visible viewport", () => {
    // Hypothetical: face fills 80% of source height, viewport only shows 50%.
    // Best we can do is center the face.
    const pos = faceSafeObjectPosition({
      naturalAspect: 0.5,
      containerAspect: 1,
      faceBox: { x: 0.0, y: 0.1, width: 1.0, height: 0.8 },
      focalPoint: { x: 0.5, y: 0.5 },
    });
    // visibleFracY = 0.5, slack = 0.5. faceMin+faceSize-vf = 0.4 → tMin=0.8.
    // tMax = 0.1/0.5 = 0.2 → tMin>tMax → fallback center: (0.1+0.4-0.25)/0.5 = 0.5
    expect(pos).toBe("50.00% 50.00%");
  });

  it("uses real Sceneify face data on a 16:9 hero crop", () => {
    // From the verified end-to-end record:
    //   face_box: { x: 0.35, y: 0.2, width: 0.15, height: 0.25 }
    //   focal_point: { x: 0.425, y: 0.325 }
    // Source 4:5, hero container 16:9. Vertical crop heavy.
    const pos = faceSafeObjectPosition({
      naturalAspect: 4 / 5,
      containerAspect: 16 / 9,
      faceBox: { x: 0.35, y: 0.2, width: 0.15, height: 0.25 },
      focalPoint: { x: 0.425, y: 0.325 },
    });
    // visibleFracY = (4/5)/(16/9) = 0.45. slack = 0.55.
    // tMin=(0.45-0.45)/0.55=0; tMax=0.2/0.55≈0.3636.
    // tFocal=(0.325-0.225)/0.55≈0.1818 → in range.
    const [, ys] = pos.split(" ");
    expect(parseFloat(ys)).toBeGreaterThan(15);
    expect(parseFloat(ys)).toBeLessThan(20);
  });
});
