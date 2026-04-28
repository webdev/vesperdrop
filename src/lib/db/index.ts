import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";
import * as schema from "./schema";

const client = neon(env.DATABASE_URL);
export const db = drizzle(client, { schema });
export { schema };
export { client as raw };
