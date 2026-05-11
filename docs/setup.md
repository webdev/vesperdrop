# Local setup

## Prereqs

- Node 20+
- pnpm 9+
- Docker or OrbStack (for Supabase + Sceneify containers)
- Supabase CLI is bundled as a devDep (no global install needed)
- Stripe CLI: `brew install stripe/stripe-cli/stripe`

## One-time

1. Install deps:
   ```
   pnpm install
   ```
2. Copy env template and fill keys:
   ```
   cp .env.local.example .env.local
   ```
3. Start Supabase local stack:
   ```
   pnpm db:start
   pnpm db:migrate
   ```
   Copy the printed `Publishable` / `Secret` keys into `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. (Supabase's modern key naming uses `sb_publishable_...` / `sb_secret_...`; both work with the SDK.)
4. Sign in to Stripe (test mode):
   ```
   stripe login
   ```
   Then create a Pro test product/price in your Stripe dashboard (test mode) and put the price id in `STRIPE_PRO_PRICE_ID`.
5. Start Sceneify in Docker on `:8080` (separate repo). Confirm it's reachable:
   ```
   curl -sf http://localhost:8080/api/presets
   ```
6. (First run only) `pnpm stripe:listen` in a separate terminal — it prints a `whsec_...` value. Paste that into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then restart `pnpm dev`.

## Google OAuth (optional)

Sign-in with Google is wired up in the auth form, but it only works once you've
configured Google credentials on your Supabase project.

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Application type: **Web application**
   - Authorized redirect URI: your Supabase project's auth callback, which is
     `https://<project-ref>.supabase.co/auth/v1/callback` for hosted projects, or
     `http://127.0.0.1:54321/auth/v1/callback` for the local stack.
2. Local dev: add the keys to `supabase/config.toml` under `[auth.external.google]`:
   ```toml
   [auth.external.google]
   enabled = true
   client_id = "env(GOOGLE_CLIENT_ID)"
   secret    = "env(GOOGLE_CLIENT_SECRET)"
   redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
   ```
   Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`, then
   restart the local stack: `pnpm db:stop && pnpm db:start`.
3. Hosted: paste the same client id / secret into Supabase Studio under
   **Auth → Providers → Google**. No code changes needed.

The app's `/api/auth/callback` route exchanges the OAuth code for a session and
redirects to `?next=...` (defaults to `/app`).

## Production SMTP (Resend)

Supabase's built-in SMTP caps email sends at **2/hour project-wide** across every
endpoint (OTP, signup confirm, password reset, email change). Custom SMTP via
Resend lifts the ceiling — the OTP-gated `/try` HD download will trip the
default cap with a single round of QA.

One-time setup:

1. **Resend** ([resend.com](https://resend.com)) → sign up, add `vesperdrop.com`
   as a domain, complete DNS verification (SPF + DKIM + DMARC records).
2. Resend → API Keys → create one with "Send access" only. Copy the `re_...`
   value somewhere safe; you can't view it again.
3. **Supabase Dashboard** → your production project → Authentication → Emails
   → SMTP Settings → enable, then paste:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: `<the re_... key>`
   - Sender email: `noreply@vesperdrop.com`
   - Sender name: `Vesperdrop`
4. **Supabase Dashboard** → Authentication → Rate Limits → bump "Emails sent
   per hour" to a real number (e.g. 100) now that custom SMTP is in place.

Local dev keeps using Inbucket — `supabase/config.toml` raises the local
`email_sent` cap to 100 so OTP testing doesn't lock you out, and `[auth.email.smtp]`
stays commented out in that file (the block doubles as a reference for the
values to enter in the dashboard).

## Daily

```
pnpm dev:all       # Next.js + Stripe webhook listener concurrently
```

In a third terminal, when needed:
```
pnpm db:status     # check supabase status
pnpm db:reset      # nuke + reapply migrations (loses data)
```

## Common tasks

- Run unit tests: `pnpm test`
- Run e2e: `pnpm test:e2e`
- Lint + typecheck: `pnpm lint`
- Database migration: drop a `supabase/migrations/<timestamp>_<name>.sql` file and `pnpm db:migrate`

## Troubleshooting

- **Sceneify unreachable**: confirm container is running and `SCENEIFY_API_URL` matches.
- **Stripe webhook signature invalid**: when `pnpm stripe:listen` starts it prints a `whsec_...` value — copy it into `.env.local` and restart `pnpm dev`.
- **Supabase ports in use** (54321–54324, 54322): `pnpm db:stop` then `pnpm db:start`.
- **`pnpm dev` says port 3000 in use**: another process owns it. Free it (`lsof -i :3000`) or run on a different port (`PORT=3001 pnpm dev`).
- **WDK auto-generated route file** (`src/app/.well-known/workflow/v1/flow/route.js`): generated at build/dev. Already gitignored.
- **Watermark images served from `public/watermarked/`** in dev (no Vercel Blob token). In prod, set `BLOB_READ_WRITE_TOKEN` and they'll go to Blob automatically.

## Architecture notes

- `lib/sceneify/` — REST client for the Sceneify image-gen service (separate process)
- `lib/workflows/` — Vercel Workflow DevKit definitions (orchestration of multi-step generation runs)
- `lib/db/` — typed Supabase query helpers (service-role; auth checked at the route layer)
- `lib/stripe/` — Stripe SDK + idempotent webhook handler
- `lib/watermark.ts` + `lib/storage.ts` — sharp-based watermark and Blob/local storage
- `app/(marketing)/` — public landing + pricing
- `app/(auth)/` — sign-in / sign-up
- `app/(app)/` — authed surface (`/app`, `/app/runs/:id`, `/account`)
- `middleware.ts` — refreshes Supabase session, redirects unauthenticated requests to /sign-in for `/app` and `/account`

For deeper context, read `docs/superpowers/specs/2026-04-25-darkroom-mvp-design.md`.
