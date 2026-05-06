// Backfill focal_point + face_box on existing etsy_preview_pages slots.
//
// For each slot row that has a generated URL but no focal data, calls
// gpt-4o-mini via the Vercel AI Gateway with structured output to detect
// the primary face. Converts the response to the project's FocalPoint /
// FaceBox shape and persists into the DB.
//
// Usage:
//   set -a && source .env.local && set +a && node scripts/backfill-etsy-focal.mjs
//
// Re-runnable: only operates on rows whose <slot>_focal_point is still NULL.
//
// Requires:  AI_GATEWAY_API_KEY, POSTGRES_URL_NON_POOLING

import postgres from "postgres";
import { generateObject } from "ai";
import { z } from "zod";

const MODEL = "openai/gpt-4o-mini";
const CONCURRENCY = 4;

const FaceSchema = z.object({
  has_face: z.boolean().describe("True if a clear human face is visible."),
  face: z
    .object({
      x: z.number().min(0).max(1).describe("Left edge of face bounding box, fraction of image width."),
      y: z.number().min(0).max(1).describe("Top edge of face bounding box, fraction of image height."),
      width: z.number().min(0).max(1).describe("Width of face bounding box, fraction of image width."),
      height: z.number().min(0).max(1).describe("Height of face bounding box, fraction of image height."),
      confidence: z.number().min(0).max(1).describe("Confidence the box is correct."),
    })
    .nullable()
    .describe("Bounding box of the most prominent face. Null if no face is visible."),
});

async function detectFace(url) {
  const { object } = await generateObject({
    model: MODEL,
    schema: FaceSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Look at this fashion product image. If there is a human face visible, " +
              "return a normalized bounding box (0-1 fractions of image dimensions) " +
              "for the most prominent face. If no face, return has_face=false and face=null.",
          },
          { type: "image", image: url },
        ],
      },
    ],
  });
  return object;
}

function toFaceBox(face) {
  return {
    x: face.x,
    y: face.y,
    width: face.width,
    height: face.height,
    confidence: face.confidence,
  };
}

function toFocalPoint(face) {
  // Center the focal point on the face box, slightly biased upward so
  // we keep eyes/forehead in frame on close crops.
  const cy = face.y + face.height * 0.4;
  return {
    x: Math.min(1, Math.max(0, face.x + face.width / 2)),
    y: Math.min(1, Math.max(0, cy)),
    confidence: face.confidence,
    source: "face",
  };
}

async function processSlot(sql, row) {
  const url = row[`${row.slot}_url`];
  console.log(`[${row.id.slice(0, 8)}/${row.slot}] detecting…`);
  let detection;
  try {
    detection = await detectFace(url);
  } catch (e) {
    console.log(`  ✗ ${e.message?.slice(0, 120)}`);
    return { ok: false };
  }

  let focal = null;
  let face = null;
  if (detection.has_face && detection.face) {
    face = toFaceBox(detection.face);
    focal = toFocalPoint(detection.face);
    console.log(
      `  ✓ face @ (${focal.x.toFixed(2)}, ${focal.y.toFixed(2)}) conf=${focal.confidence.toFixed(2)}`,
    );
  } else {
    // Fallback: center focal point so the FaceSafeImage renders the same
    // as the previous default. We persist a non-null value to mark the
    // row as backfilled and avoid retrying it on subsequent runs.
    focal = { x: 0.5, y: 0.5, confidence: 0, source: "center" };
    console.log("  · no face, defaulting to center");
  }

  const slotCol = row.slot;
  const fpCol = `${slotCol}_focal_point`;
  const fbCol = `${slotCol}_face_box`;
  await sql`
    update etsy_preview_pages
       set ${sql(fpCol)} = ${sql.json(focal)}::jsonb,
           ${sql(fbCol)} = ${face ? sql.json(face) : null}::jsonb,
           updated_at = now()
     where id = ${row.id}
  `;
  return { ok: true };
}

async function chunkAndRun(items, size, fn) {
  let done = 0;
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
    done += Math.min(size, items.length - i);
    console.log(`— progress: ${done}/${items.length}`);
  }
}

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error("POSTGRES_URL_NON_POOLING missing");
  process.exit(1);
}
if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("AI_GATEWAY_API_KEY missing");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 4 });

const rows = await sql`
  select id, hero_url, lifestyle_url, detail_url,
         hero_focal_point, lifestyle_focal_point, detail_focal_point
    from etsy_preview_pages
   where status in ('completed', 'partial')
`;

const todo = [];
for (const r of rows) {
  if (r.hero_url && !r.hero_focal_point) todo.push({ id: r.id, slot: "hero" });
  if (r.lifestyle_url && !r.lifestyle_focal_point)
    todo.push({ id: r.id, slot: "lifestyle" });
  if (r.detail_url && !r.detail_focal_point)
    todo.push({ id: r.id, slot: "detail" });
}

console.log(`Backfilling ${todo.length} slots…\n`);
let okCount = 0;
let errCount = 0;
await chunkAndRun(todo, CONCURRENCY, async (t) => {
  // Re-fetch each row so we have all url columns at hand
  const [full] = await sql`select * from etsy_preview_pages where id = ${t.id}`;
  const result = await processSlot(sql, { ...full, slot: t.slot });
  if (result.ok) okCount++;
  else errCount++;
});

console.log(`\nDone. ✓ ${okCount}  ✗ ${errCount}`);
await sql.end();
