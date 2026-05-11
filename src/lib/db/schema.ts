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
  jsonb,
} from "drizzle-orm/pg-core";
import type { FocalPoint, FaceBox } from "@/lib/ai/sceneify";

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
  quotaUnitsBalance: integer("quota_units_balance").notNull().default(1),
  planBillingInterval: text("plan_billing_interval", {
    enum: ["monthly", "annual"],
  })
    .notNull()
    .default("monthly"),
  annualLastGrantedAt: timestamp("annual_last_granted_at", {
    withTimezone: true,
  }),
  lastFailedRunAt: timestamp("last_failed_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // Nullable for the unauth /try funnel — anonymous runs live with
    // userId=null until the visitor OTP-claims the batch, at which
    // point /api/try/attach-batch UPDATEs this column.
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    sourceCount: integer("source_count").notNull(),
    presetCount: integer("preset_count").notNull(),
    totalImages: integer("total_images").notNull(),
    name: text("name"),
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
    // Nullable for the unauth /try funnel — anonymous generations have
    // a run but no owning user until OTP claim re-parents the rows.
    runId: uuid("run_id").references(() => runs.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    sceneifySourceId: text("sceneify_source_id").notNull(),
    sceneifyGenerationId: text("sceneify_generation_id"),
    presetId: text("preset_id").notNull(),
    parentGenerationId: uuid("parent_generation_id"),
    packId: uuid("pack_id"),
    packRole: text("pack_role"),
    packShotIndex: integer("pack_shot_index"),
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
    focalPoint: jsonb("focal_point").$type<FocalPoint>(),
    faceBox: jsonb("face_box").$type<FaceBox>(),
    wasOverage: boolean("was_overage").notNull().default(false),
  },
  (t) => [
    index("generations_run_idx").on(t.runId),
    index("generations_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("generations_status_idx").on(t.status),
    index("generations_pack_idx").on(t.packId),
    index("generations_parent_idx").on(t.parentGenerationId),
  ],
);

// Per-generation overage charges. Idempotent via the (user_id, generation_id)
// unique index — workflow retries that re-enter the overage hook cannot
// double-bill. Cycle anchor = subscription's current_period_start, used by
// the plan summary card to sum accrual since the cycle began.
export const overageLedger = pgTable(
  "overage_ledger",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    generationId: uuid("generation_id").references(() => generations.id, {
      onDelete: "set null",
    }),
    cents: integer("cents").notNull(),
    stripeUsageRecordId: text("stripe_usage_record_id"),
    reportedAt: timestamp("reported_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    cycleAnchor: timestamp("cycle_anchor", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("overage_ledger_user_cycle_idx").on(
      t.userId,
      t.cycleAnchor.desc(),
    ),
  ],
);

export type OverageLedger = typeof overageLedger.$inferSelect;

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

export const completeLookPacks = pgTable(
  "complete_look_packs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    parentGenerationId: uuid("parent_generation_id")
      .notNull()
      .references(() => generations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    platform: text("platform", {
      enum: ["amazon", "shopify", "instagram", "tiktok"],
    }).notNull(),
    sceneifyPackId: text("sceneify_pack_id").notNull(),
    shotCount: integer("shot_count").notNull(),
    quotaUnitsSpent: integer("quota_units_spent").notNull(),
    status: text("status", {
      enum: ["pending", "running", "succeeded", "partial", "failed"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("complete_look_packs_parent_platform_key").on(
      t.parentGenerationId,
      t.platform,
    ),
    index("complete_look_packs_run_idx").on(t.runId),
    index("complete_look_packs_user_created_idx").on(
      t.userId,
      t.createdAt.desc(),
    ),
  ],
);

export const etsyCandidates = pgTable(
  "etsy_candidates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    listingUrl: text("listing_url").notNull().unique(),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    shopName: text("shop_name"),
    shopUrl: text("shop_url"),
    category: text("category"),
    description: text("description"),
    tags: text("tags").array(),
    rawMd: text("raw_md").notNull(),
    status: text("status", {
      enum: [
        "pending",
        "generating",
        "completed",
        "partial",
        "failed",
        "skipped",
        "to_review",
      ],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    reachedOutAt: timestamp("reached_out_at", { withTimezone: true }),
  },
  (t) => [index("etsy_candidates_status_idx").on(t.status)],
);

export const etsyPreviewPages = pgTable(
  "etsy_preview_pages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => etsyCandidates.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    status: text("status", {
      enum: ["pending", "queued", "generating", "partial", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    sourceBlobUrl: text("source_blob_url"),
    listingSnapshot: jsonb("listing_snapshot")
      .notNull()
      .$type<{
        title: string;
        listingUrl: string;
        imageUrl: string | null;
        shopName: string | null;
        category: string | null;
      }>(),
    heroUrl: text("hero_url"),
    heroStatus: text("hero_status").notNull().default("pending"),
    heroError: text("hero_error"),
    heroFocalPoint: jsonb("hero_focal_point").$type<FocalPoint>(),
    heroFaceBox: jsonb("hero_face_box").$type<FaceBox>(),
    lifestyleUrl: text("lifestyle_url"),
    lifestyleStatus: text("lifestyle_status").notNull().default("pending"),
    lifestyleError: text("lifestyle_error"),
    lifestyleFocalPoint: jsonb("lifestyle_focal_point").$type<FocalPoint>(),
    lifestyleFaceBox: jsonb("lifestyle_face_box").$type<FaceBox>(),
    detailUrl: text("detail_url"),
    detailStatus: text("detail_status").notNull().default("pending"),
    detailError: text("detail_error"),
    detailFocalPoint: jsonb("detail_focal_point").$type<FocalPoint>(),
    detailFaceBox: jsonb("detail_face_box").$type<FaceBox>(),
    viewCount: integer("view_count").notNull().default(0),
    ctaClickCount: integer("cta_click_count").notNull().default(0),
    signupClickCount: integer("signup_click_count").notNull().default(0),
    signupCount: integer("signup_count").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("etsy_preview_pages_candidate_idx").on(t.candidateId),
    index("etsy_preview_pages_status_idx").on(t.status),
  ],
);

export const etsyPreviewEvents = pgTable(
  "etsy_preview_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => etsyPreviewPages.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["view", "cta_click", "signup_start", "signup"],
    }).notNull(),
    label: text("label"),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("etsy_preview_events_page_idx").on(t.pageId),
    index("etsy_preview_events_created_idx").on(t.createdAt.desc()),
  ],
);

export const igPreviews = pgTable(
  "ig_previews",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull().unique(),
    title: text("title"),
    presetSlug: text("preset_slug").notNull(),
    sourceImages: jsonb("source_images")
      .notNull()
      .$type<Array<{ url: string; name: string; mimeType: string }>>(),
    presetSlugs: text("preset_slugs").array().notNull(),
    expectedOutputCount: integer("expected_output_count").notNull(),
    notes: text("notes"),
    status: text("status", {
      enum: ["pending", "queued", "generating", "completed", "partial", "failed"],
    })
      .notNull()
      .default("pending"),
    outputs: jsonb("outputs")
      .notNull()
      .$type<
        Array<{
          url: string;
          sourceIndex: number;
          presetSlug: string;
          slotType?: "lifestyle_hero" | "storefront" | "detail";
          focalPoint?: FocalPoint | null;
          faceBox?: FaceBox | null;
        }>
      >()
      .default(sql`'[]'::jsonb`),
    viewCount: integer("view_count").notNull().default(0),
    ctaClickCount: integer("cta_click_count").notNull().default(0),
    signupClickCount: integer("signup_click_count").notNull().default(0),
    signupCount: integer("signup_count").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("ig_previews_slug_key").on(t.slug),
    index("ig_previews_created_idx").on(t.createdAt.desc()),
    index("ig_previews_status_idx").on(t.status),
  ],
);

export const igPreviewEvents = pgTable(
  "ig_preview_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    previewId: uuid("preview_id")
      .notNull()
      .references(() => igPreviews.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["view", "cta_click", "signup_start", "signup"],
    }).notNull(),
    label: text("label"),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("ig_preview_events_preview_idx").on(t.previewId),
    index("ig_preview_events_created_idx").on(t.createdAt.desc()),
  ],
);

// Pending "Try free" intents persisted server-side so the upload + scene
// selection survive across devices when the user signs up but opens the
// confirmation email on a different machine. Keyed by lowercased email
// (we don't have a user_id at the time the row is written — signUp's
// session is null with email confirmation enabled). One unconsumed row
// per email at a time; latest insert wins. Consumed rows are kept for a
// short while for debugging then can be GC'd.
export const tryIntents = pgTable(
  "try_intents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: text("email").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceName: text("source_name").notNull(),
    sourceMimeType: text("source_mime_type").notNull(),
    pickedScenes: jsonb("picked_scenes").notNull().$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [
    // Lookup path is by email + "is unconsumed" — composite index covers
    // both the consume-intent SELECT and the save-intent uniqueness check
    // (we don't enforce uniqueness; the SELECT just orders by createdAt
    // DESC and limits 1).
    index("try_intents_email_unconsumed_idx").on(
      t.email,
      t.consumedAt,
      t.createdAt.desc(),
    ),
  ],
);

export type TryIntent = typeof tryIntents.$inferSelect;

// One row per "$9.99 unlock" funnel — created when an unauth visitor
// finishes streaming 3 generations (1 free + 2 locked + bonus). The
// row is keyed by an opaque token used as the URL path on the post-pay
// landing page; status flips from 'pending' to 'paid' when Stripe's
// checkout.session.completed webhook lands. The post-pay page also
// verifies the Stripe session as a synchronous fallback so the user
// isn't blocked by webhook delivery latency.
export type UnlockBatchGeneration = {
  sceneSlug: string;
  sceneName: string;
  outputUrl: string; // watermarked
  rawUrl: string | null; // un-watermarked; what we hand back after payment
  isBonus: boolean; // bonus tile (server-picked scene, not user-picked)
  isFreePreview: boolean; // index 0 — visible without payment
  // Normalized 0..1 coordinates returned by Sceneify. The render
  // layer applies object-position: {x*100}% {y*100}% so the subject
  // (usually a face) stays in frame even when the tile crops.
  focalPoint?: FocalPoint | null;
  faceBox?: FaceBox | null;
};

export const unlockBatches = pgTable("unlock_batches", {
  token: text("token").primaryKey(),
  generations: jsonb("generations").$type<UnlockBatchGeneration[]>().notNull(),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntent: text("stripe_payment_intent"),
  customerEmail: text("customer_email"),
  userId: uuid("user_id"),
  // FK to the runs row that owns this batch's generations. Set when
  // /api/try/finalize-batch writes the run + generation rows; nullable
  // for back-compat with batches created before the DB-row migration.
  runId: uuid("run_id").references(() => runs.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true })
    .notNull()
    .default(sql`now() + interval '7 days'`),
});

export type UnlockBatch = typeof unlockBatches.$inferSelect;

// Anon credit ledger for the unauth /try/generate path. Each visitor
// gets `credits_remaining` (default 3) keyed on a cookie-stored
// anon_id. Atomic decrement happens via try_consume_anon_credit RPC.
export const anonCredits = pgTable("anon_credits", {
  anonId: uuid("anon_id").primaryKey().default(sql`gen_random_uuid()`),
  creditsRemaining: integer("credits_remaining").notNull().default(3),
  fingerprintHash: text("fingerprint_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type AnonCredit = typeof anonCredits.$inferSelect;

export type EtsyCandidate = typeof etsyCandidates.$inferSelect;
export type EtsyPreviewPage = typeof etsyPreviewPages.$inferSelect;
export type EtsyPreviewEvent = typeof etsyPreviewEvents.$inferSelect;
export type IgPreview = typeof igPreviews.$inferSelect;
export type IgPreviewEvent = typeof igPreviewEvents.$inferSelect;

export type Profile = typeof profiles.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type UsageMonthly = typeof usageMonthly.$inferSelect;
export type StripeEvent = typeof stripeEvents.$inferSelect;
export type RateLimit = typeof rateLimits.$inferSelect;
export type CompleteLookPack = typeof completeLookPacks.$inferSelect;
export type Scene = typeof scenes.$inferSelect;
