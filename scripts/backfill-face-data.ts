import postgres from "postgres";

/**
 * Backfill focal_point + face_box for old generations that predate face
 * detection in Sceneify. Walks succeeded rows with output_url where face_box
 * is null, calls OpenAI gpt-4o vision directly with the same JSON schema
 * Sceneify uses, and writes the result back.
 *
 *   tsx scripts/backfill-face-data.ts [--dry-run]
 *
 * Reads POSTGRES_URL_NON_POOLING and OPENAI_API_KEY from env. Sequential —
 * only ~22 rows, no need to parallelise.
 */

const dryRun = process.argv.includes("--dry-run");

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

type Row = { id: string; output_url: string };

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
type FocalResult = { focalPoint: FocalPoint; faceBox: FaceBox | null };

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

async function detectFocal(imageUrl: string): Promise<FocalResult> {
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

async function main() {
  const rows = await sql<Row[]>`
    select id, output_url
    from generations
    where status = 'succeeded'
      and output_url is not null
      and face_box is null
    order by created_at asc
  `;
  console.log(`found ${rows.length} rows to backfill${dryRun ? " (DRY RUN)" : ""}`);

  let ok = 0;
  let failed = 0;
  for (const [i, row] of rows.entries()) {
    const tag = `[${i + 1}/${rows.length}] ${row.id}`;
    try {
      const result = await detectFocal(row.output_url);
      const summary = result.faceBox
        ? `face conf=${result.faceBox.confidence.toFixed(2)} focal=${result.focalPoint.source}`
        : `no-face source=${result.focalPoint.source}`;
      if (dryRun) {
        console.log(`${tag} → ${summary} (skipped write)`);
      } else {
        await sql`
          update generations
          set focal_point = ${sql.json(result.focalPoint)},
              face_box = ${sql.json(result.faceBox)}
          where id = ${row.id}
        `;
        console.log(`${tag} → ${summary}`);
      }
      ok++;
    } catch (err) {
      failed++;
      console.error(`${tag} FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\ndone — ${ok} succeeded, ${failed} failed`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
