CREATE TABLE "complete_look_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"parent_generation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"sceneify_pack_id" text NOT NULL,
	"shot_count" integer NOT NULL,
	"credits_spent" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etsy_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_url" text NOT NULL,
	"title" text NOT NULL,
	"image_url" text,
	"shop_name" text,
	"shop_url" text,
	"category" text,
	"description" text,
	"tags" text[],
	"raw_md" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "etsy_candidates_listing_url_unique" UNIQUE("listing_url")
);
--> statement-breakpoint
CREATE TABLE "etsy_preview_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "etsy_preview_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"page_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etsy_preview_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_blob_url" text,
	"listing_snapshot" jsonb NOT NULL,
	"hero_url" text,
	"hero_status" text DEFAULT 'pending' NOT NULL,
	"hero_error" text,
	"lifestyle_url" text,
	"lifestyle_status" text DEFAULT 'pending' NOT NULL,
	"lifestyle_error" text,
	"detail_url" text,
	"detail_status" text DEFAULT 'pending' NOT NULL,
	"detail_error" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"cta_click_count" integer DEFAULT 0 NOT NULL,
	"signup_click_count" integer DEFAULT 0 NOT NULL,
	"signup_count" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "etsy_preview_pages_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sceneify_source_id" text NOT NULL,
	"sceneify_generation_id" text,
	"preset_id" text NOT NULL,
	"parent_generation_id" uuid,
	"pack_id" uuid,
	"pack_role" text,
	"pack_shot_index" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"output_url" text,
	"watermarked" boolean DEFAULT false NOT NULL,
	"error" text,
	"model_used" text,
	"quality" text DEFAULT 'hd' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"focal_point" jsonb,
	"face_box" jsonb
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"stripe_customer_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"plan_renews_at" timestamp with time zone,
	"credits_balance" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"user_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"tokens" integer NOT NULL,
	"refilled_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limits_user_id_bucket_pk" PRIMARY KEY("user_id","bucket")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_count" integer NOT NULL,
	"preset_count" integer NOT NULL,
	"total_images" integer NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"mood" text NOT NULL,
	"category" text NOT NULL,
	"palette" text[] NOT NULL,
	"image_url" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_monthly" (
	"user_id" uuid NOT NULL,
	"year_month" text NOT NULL,
	"generation_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_monthly_user_id_year_month_pk" PRIMARY KEY("user_id","year_month")
);
--> statement-breakpoint
ALTER TABLE "complete_look_packs" ADD CONSTRAINT "complete_look_packs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complete_look_packs" ADD CONSTRAINT "complete_look_packs_parent_generation_id_generations_id_fk" FOREIGN KEY ("parent_generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complete_look_packs" ADD CONSTRAINT "complete_look_packs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etsy_preview_events" ADD CONSTRAINT "etsy_preview_events_page_id_etsy_preview_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."etsy_preview_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etsy_preview_pages" ADD CONSTRAINT "etsy_preview_pages_candidate_id_etsy_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."etsy_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_monthly" ADD CONSTRAINT "usage_monthly_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "complete_look_packs_parent_platform_key" ON "complete_look_packs" USING btree ("parent_generation_id","platform");--> statement-breakpoint
CREATE INDEX "complete_look_packs_run_idx" ON "complete_look_packs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "complete_look_packs_user_created_idx" ON "complete_look_packs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "etsy_candidates_status_idx" ON "etsy_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "etsy_preview_events_page_idx" ON "etsy_preview_events" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "etsy_preview_events_created_idx" ON "etsy_preview_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "etsy_preview_pages_candidate_idx" ON "etsy_preview_pages" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "etsy_preview_pages_status_idx" ON "etsy_preview_pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generations_run_idx" ON "generations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "generations_user_created_idx" ON "generations" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "generations_status_idx" ON "generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generations_pack_idx" ON "generations" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "generations_parent_idx" ON "generations" USING btree ("parent_generation_id");--> statement-breakpoint
CREATE INDEX "runs_user_created_idx" ON "runs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "scenes_slug_key" ON "scenes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "scenes_display_order_idx" ON "scenes" USING btree ("display_order");