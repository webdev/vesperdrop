import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sqlClient = neon(url);
const dir = path.join(process.cwd(), "drizzle", "sql");

async function main() {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const content = await readFile(path.join(dir, file), "utf8");
    console.log(`applying ${file}`);
    await sqlClient.query(content);
  }
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
