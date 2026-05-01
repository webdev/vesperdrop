<wizard-report>
# PostHog post-wizard report

The wizard completed a full PostHog integration for Vesperdrop. The project already had `posthog-js` and `posthog-node` installed, a `PostHogProvider` wrapping the root layout, and a well-typed `analytics.ts` helper. This pass added the missing pieces: automatic error tracking (`capture_exceptions`), explicit error reporting in all three app error boundaries, a `run_complete` client event in the run grid, updated environment variables, and a PostHog dashboard with five insights.

## Changes made

| File | Change |
|------|--------|
| `src/components/posthog-provider.tsx` | Added `capture_exceptions: true` to enable automatic unhandled exception tracking |
| `src/app/(app)/app/error.tsx` | Added `posthog.captureException(error)` via `useEffect` |
| `src/app/(app)/app/runs/[id]/error.tsx` | Added `posthog.captureException(error)` via `useEffect` |
| `src/app/(app)/account/error.tsx` | Added `posthog.captureException(error)` via `useEffect` |
| `src/lib/analytics.ts` | Added `run_complete` to the typed `AnalyticsEvent` union |
| `src/app/(app)/app/runs/[id]/run-grid.tsx` | Fires `run_complete` (with succeeded/failed/total counts) once per run when all generations resolve |
| `.env.local` | `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` written/verified |

## Event inventory

| Event | Description | File |
|-------|-------------|------|
| `try_upload_started` | User dropped, browsed, or sampled a product photo | `src/app/try/try-flow.tsx` |
| `try_scene_picked` | User toggled a scene preset selection | `src/app/try/try-flow.tsx` |
| `try_develop_started` | User clicked "Develop my batch" | `src/app/try/try-flow.tsx` |
| `try_develop_complete` | Develop animation finished; batch "ready" | `src/app/try/try-flow.tsx` |
| `try_signup_gate_seen` | Sign-up gate modal appeared | `src/app/try/try-flow.tsx` |
| `try_signup_clicked` | User clicked "Create your account" in the gate | `src/app/try/try-flow.tsx` |
| `pricing_plan_clicked` | Subscription plan CTA clicked on pricing page | `src/components/marketing/pricing-cards.tsx` |
| `pricing_pack_clicked` | One-time credit pack CTA clicked on pricing page | `src/components/marketing/pricing-cards.tsx` |
| `checkout_success` | Client-side confirmation after Stripe checkout redirect | `src/components/checkout-success-tracker.tsx` |
| `upgrade_clicked` | "Upgrade to Pro" clicked on account page | `src/components/app/upgrade-button.tsx` |
| `user_signed_up` | New account created (email or OAuth) + `identify()` called | `src/components/app/auth-form.tsx` |
| `user_signed_in` | Sign-in succeeded + `identify()` called | `src/components/app/auth-form.tsx` |
| `run_started` | Generation run created (server-side) | `src/app/api/runs/route.ts` |
| `run_complete` | All generations in a run resolved; reports succeeded/failed counts | `src/app/(app)/app/runs/[id]/run-grid.tsx` |
| `run_credits_insufficient` | Run blocked by empty credit balance (server-side) | `src/app/api/runs/route.ts` |
| `subscription_activated` | Stripe `checkout.session.completed` processed (server-side) | `src/lib/stripe/webhook.ts` |
| `subscription_renewed` | Stripe `invoice.payment_succeeded` processed (server-side) | `src/lib/stripe/webhook.ts` |
| `subscription_cancelled` | Stripe `customer.subscription.deleted/paused` processed (server-side) | `src/lib/stripe/webhook.ts` |
| `$exception` | Automatic + explicit error captures in all three app error boundaries | `src/app/(app)/app/error.tsx`, `src/app/(app)/app/runs/[id]/error.tsx`, `src/app/(app)/account/error.tsx` |

## Next steps

We've built a dashboard and five insights to monitor user behaviour:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/402035/dashboard/1522584
- **Free-to-paid conversion funnel** (signup gate → signup → account → subscription): https://us.posthog.com/project/402035/insights/G8UzoksL
- **Try flow drop-off funnel** (upload → develop → complete → gate): https://us.posthog.com/project/402035/insights/xqNdDIkU
- **Subscription events over time** (activations, renewals, cancellations): https://us.posthog.com/project/402035/insights/s4aRKX7L
- **Generation run activity** (started, completed, blocked by credits): https://us.posthog.com/project/402035/insights/kF7kgQZE
- **Pricing page engagement** (plan clicks, pack clicks, upgrade clicks, checkout success): https://us.posthog.com/project/402035/insights/qdh3wwH4

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
