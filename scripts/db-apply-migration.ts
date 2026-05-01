import { readFile } from "node:fs/promises";
import postgres from "postgres";

/**
 * Apply a single SQL migration file against POSTGRES_URL_NON_POOLING.
 * Used for one-shot migrations when Drizzle's `push` would over-reach
 * and the Supabase CLI isn't authenticated.
 *
 *   tsx scripts/db-apply-migration.ts supabase/migrations/<file>.sql
 */
const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/db-apply-migration.ts <path-to-sql>");
  process.exit(1);
}

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL;
if (!url) {
  console.error("POSTGRES_URL_NON_POOLING (or DATABASE_URL) is not set");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1 });

async function main() {
  const content = await readFile(file, "utf8");
  console.log(`applying ${file}`);
  await sql.unsafe(content);
  console.log("done");
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
});
