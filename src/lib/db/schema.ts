import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// profiles.id was historically a FK to auth.users(id) under Supabase. Phase B
// will rebind this to NextAuth's user id (string). For now we keep it as a
// standalone uuid PK so Neon doesn't need an auth.users table.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  plan: text("plan", { enum: ["free", "starter", "pro", "studio", "agency"] })
    .notNull()
    .default("free"),
  planRenewsAt: timestamp("plan_renews_at", { withTimezone: true }),
  creditsBalance: integer("credits_balance").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sourceCount: integer("source_count").notNull(),
    presetCount: integer("preset_count").notNull(),
    totalImages: integer("total_images").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("runs_user_created_idx").on(t.userId, t.createdAt.desc())],
);

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sceneifySourceId: text("sceneify_source_id").notNull(),
    sceneifyGenerationId: text("sceneify_generation_id"),
    presetId: text("preset_id").notNull(),
    status: text("status", {
      enum: ["pending", "running", "succeeded", "failed"],
    })
      .notNull()
      .default("pending"),
    outputUrl: text("output_url"),
    watermarked: boolean("watermarked").notNull().default(false),
    error: text("error"),
    modelUsed: text("model_used"),
    quality: text("quality", { enum: ["preview", "hd"] })
      .notNull()
      .default("hd"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("generations_run_idx").on(t.runId),
    index("generations_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("generations_status_idx").on(t.status),
  ],
);

export const usageMonthly = pgTable(
  "usage_monthly",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(),
    generationCount: integer("generation_count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.yearMonth] })],
);

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(),
    tokens: integer("tokens").notNull(),
    refilledAt: timestamp("refilled_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bucket] })],
);

export const scenes = pgTable(
  "scenes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    mood: text("mood").notNull(),
    category: text("category").notNull(),
    palette: text("palette").array().notNull(),
    imageUrl: text("image_url").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("scenes_slug_key").on(t.slug),
    index("scenes_display_order_idx").on(t.displayOrder),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type UsageMonthly = typeof usageMonthly.$inferSelect;
export type StripeEvent = typeof stripeEvents.$inferSelect;
export type RateLimit = typeof rateLimits.$inferSelect;
export type Scene = typeof scenes.$inferSelect;
