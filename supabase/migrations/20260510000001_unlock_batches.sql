-- $9.99 unauth unlock funnel: persists generated batches keyed by a
-- public token. The webhook flips status='paid' on
-- checkout.session.completed; the /try/unlocked/[token] page reads
-- by token and reveals the un-watermarked raw URLs to the buyer.
create table if not exists "unlock_batches" (
  "token" text primary key not null,
  "generations" jsonb not null,
  "status" text not null default 'pending',
  "paid_at" timestamp with time zone,
  "stripe_session_id" text,
  "stripe_payment_intent" text,
  "customer_email" text,
  "user_id" uuid,
  "created_at" timestamp with time zone not null default now(),
  -- A future cleanup job can reap unpaid rows past this date.
  "expires_at" timestamp with time zone not null default (now() + interval '7 days')
);

create index if not exists "unlock_batches_status_idx" on "unlock_batches" ("status");
create index if not exists "unlock_batches_expires_at_idx" on "unlock_batches" ("expires_at");
