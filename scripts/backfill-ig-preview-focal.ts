import postgres from "postgres";

/**
 * Backfill focalPoint + faceBox for ig_previews.outputs[] entries created
 * before the workflow captured them. Calls OpenAI gpt-4o vision per output
 * (only when focalPoint is missing) using the same JSON schema sceneify uses.
 *
 *   tsx scripts/backfill-ig-preview-focal.ts [--dry-run] [--slug <slug>]
 *
 * Reads POSTGRES_URL_NON_POOLING and OPENAI_API_KEY from env.
 */

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const slugIdx = args.indexOf("--slug");
const onlySlug = slugIdx >= 0 ? args[slugIdx + 1] : null;

const dbUrl = process.env.POSTGRES_URL_NON_POOLING;
if (!dbUrl) {
  console.error("POSTGRES_URL_NON_POOLING is not set");
  process.exit(1);
}
const openaiKey = process.env.OPENAI_API_KEY;
if (!openaiKey) {
  console.error("OPENAI_API_KEY is not set");
  process.exit(1);
}

type FocalSource = "face" | "saliency" | "center";
type FocalPoint = {
  x: number;
  y: number;
  confidence: number;
  source: FocalSource;
};
type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};
type IgOutput = {
  url: string;
  sourceIndex: number;
  presetSlug: string;
  slotType?: string;
  focalPoint?: FocalPoint | null;
  faceBox?: FaceBox | null;
};

const SYSTEM_PROMPT = `You analyze a single image and return a focal point and (if applicable) the dominant subject's face bounding box, both in normalized 0..1 coordinates relative to the image's natural width and height.

Rules:
- If a clear human face is visible, set hasFace=true and faceBox to the largest/most-central face. focalSource="face" and focalX/focalY land on the face center (between the eyes, slightly above the nose).
- If no face is present but there is an obvious salient subject (product, garment, single object), focalSource="saliency" and focalX/focalY mark the subject's visual center of mass. faceBox=null.
- If neither a face nor a clear salient subject is detected, return focalSource="center", focalX=0.5, focalY=0.5, faceBox=null, focalConfidence<=0.4.
- Do NOT invent a face. If you are unsure, set hasFace=false.
- Coordinates are 0..1 with origin at the top-left of the image.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hasFace", "faceBox", "focalX", "focalY", "focalConfidence", "focalSource"],
  properties: {
    hasFace: { type: "boolean" },
    faceBox: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["x", "y", "width", "height", "confidence"],
          properties: {
            x: { type: "number", minimum: 0, maximum: 1 },
            y: { type: "number", minimum: 0, maximum: 1 },
            width: { type: "number", minimum: 0, maximum: 1 },
            height: { type: "number", minimum: 0, maximum: 1 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
        { type: "null" },
      ],
    },
    focalX: { type: "number", minimum: 0, maximum: 1 },
    focalY: { type: "number", minimum: 0, maximum: 1 },
    focalConfidence: { type: "number", minimum: 0, maximum: 1 },
    focalSource: { type: "string", enum: ["face", "saliency", "center"] },
  },
} as const;

const CENTER_FOCAL: FocalPoint = {
  x: 0.5,
  y: 0.5,
  confidence: 1,
  source: "center",
};

async function detectFocal(
  imageUrl: string,
): Promise<{ focalPoint: FocalPoint; faceBox: FaceBox | null }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Return the focal point and face box for this image." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "focal_result", strict: true, schema: RESPONSE_SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return { focalPoint: CENTER_FOCAL, faceBox: null };
  }
  const obj = JSON.parse(content);
  const focalPoint: FocalPoint = {
    x: obj.focalX,
    y: obj.focalY,
    confidence: obj.focalConfidence,
    source: obj.focalSource,
  };
  const faceBox: FaceBox | null =
    obj.hasFace && obj.faceBox && obj.faceBox.confidence >= 0.5
      ? obj.faceBox
      : null;
  return { focalPoint, faceBox };
}

const sql = postgres(dbUrl, { ssl: "require", max: 1 });

type Row = { id: string; slug: string; outputs: IgOutput[] };

async function main() {
  const rows = onlySlug
    ? await sql<Row[]>`
        select id, slug, outputs
        from ig_previews
        where slug = ${onlySlug}
        limit 1
      `
    : await sql<Row[]>`
        select id, slug, outputs
        from ig_previews
        order by created_at asc
      `;

  let totalOutputs = 0;
  let totalToFix = 0;
  for (const row of rows) {
    for (const o of row.outputs) {
      totalOutputs += 1;
      if (!o.focalPoint) totalToFix += 1;
    }
  }
  console.log(
    `${rows.length} previews, ${totalOutputs} outputs, ${totalToFix} need backfill${dryRun ? " (DRY RUN)" : ""}`,
  );

  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    let mutated = false;
    const next = [...row.outputs];
    for (let i = 0; i < next.length; i += 1) {
      const o = next[i];
      if (o.focalPoint) continue;
      const tag = `[${row.slug}#${i}]`;
      try {
        const result = await detectFocal(o.url);
        const summary = result.faceBox
          ? `face conf=${result.faceBox.confidence.toFixed(2)} focal=${result.focalPoint.source}`
          : `no-face source=${result.focalPoint.source}`;
        if (dryRun) {
          console.log(`${tag} → ${summary} (skipped write)`);
        } else {
          next[i] = {
            ...o,
            focalPoint: result.focalPoint,
            faceBox: result.faceBox,
          };
          mutated = true;
          console.log(`${tag} ✓ ${summary}`);
        }
        ok += 1;
      } catch (e) {
        failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`${tag} ✗ ${msg}`);
      }
    }
    if (mutated) {
      await sql`
        update ig_previews
        set outputs = ${sql.json(next)},
            updated_at = now()
        where id = ${row.id}
      `;
    }
  }

  console.log(`done: ${ok} ok, ${failed} failed`);
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
});
