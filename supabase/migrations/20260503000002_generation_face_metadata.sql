-- Sceneify now returns focal point + dominant face bounding box on each
-- generation. Persist them so we can crop intelligently without re-detecting
-- on every render.
--
-- focal_point shape: { x: number, y: number, confidence: number,
--                      source: "face" | "saliency" | "center" }
-- face_box shape:    { x: number, y: number, width: number, height: number,
--                      confidence: number }
-- Both x/y/width/height are normalized 0–1 against the output image's
-- natural width/height.
alter table public.generations
  add column if not exists focal_point jsonb,
  add column if not exists face_box jsonb;
