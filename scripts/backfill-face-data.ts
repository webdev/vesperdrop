import postgres from "postgres";

/**
 * Backfill focal_point + face_box for old generations that predate the
 * Sceneify face-detection deploy. Walks succeeded rows with output_url where
 * face_box is null, calls the Sceneify admin detect-focal endpoint, and
 * writes the result back.
 *
 *   SCENEIFY_BACKFILL_SECRET=... tsx scripts/backfill-face-data.ts [--dry-run]
 *
 * Reads POSTGRES_URL_NON_POOLING and SCENEIFY_API_URL from env (already
 * present in .env.local). Sequential — only ~22 rows, no need to parallelise.
 */

const dryRun = process.argv.includes("--dry-run");

const dbUrl = process.env.POSTGRES_URL_NON_POOLING;
if (!dbUrl) {
  console.error("POSTGRES_URL_NON_POOLING is not set");
  process.exit(1);
}

const sceneifyUrl = (process.env.SCENEIFY_API_URL ?? "").replace(/\/$/, "");
if (!sceneifyUrl) {
  console.error("SCENEIFY_API_URL is not set");
  process.exit(1);
}

const secret = process.env.SCENEIFY_BACKFILL_SECRET;
if (!secret) {
  console.error("SCENEIFY_BACKFILL_SECRET is not set");
  process.exit(1);
}

type Row = { id: string; output_url: string };
type FocalResult = {
  focalPoint: {
    x: number;
    y: number;
    confidence: number;
    source: "face" | "saliency" | "center";
  };
  faceBox:
    | { x: number; y: number; width: number; height: number; confidence: number }
    | null;
};

const sql = postgres(dbUrl, { ssl: "require", max: 1 });

async function detectFocalForUrl(imageUrl: string): Promise<FocalResult> {
  const res = await fetch(`${sceneifyUrl}/api/admin/detect-focal-by-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ imageUrl }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`sceneify ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as FocalResult;
}

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
      const result = await detectFocalForUrl(row.output_url);
      const summary = result.faceBox
        ? `face@${result.focalPoint.source} conf=${result.faceBox.confidence.toFixed(2)}`
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
