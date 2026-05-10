CREATE TABLE "unlock_batches" (
	"token" text PRIMARY KEY NOT NULL,
	"generations" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"stripe_session_id" text,
	"stripe_payment_intent" text,
	"customer_email" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '7 days' NOT NULL
);
