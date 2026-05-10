CREATE TABLE "try_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"source_url" text NOT NULL,
	"source_name" text NOT NULL,
	"source_mime_type" text NOT NULL,
	"picked_scenes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "try_intents_email_unconsumed_idx" ON "try_intents" USING btree ("email","consumed_at","created_at" DESC NULLS LAST);
