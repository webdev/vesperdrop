# Vesperdrop — Design & Implementation System

This document defines **non-negotiable rules** for UI, UX, architecture, and implementation.

Claude must follow these rules strictly.

---

# 1. Core Principle

This system is:

- **Deterministic**
- **Idempotent**
- **Constraint-driven**

Claude is NOT designing.

Claude is implementing a **predefined system**.

---

# 2. Global Layout Rules (STRICT)

- All pages MUST use centered layout
- Max width:
  - Page container → `var(--container-max)`
  - Content → `var(--content-max)`

- Never allow full-width stretching unless explicitly specified
- Content must visually center on all screen sizes

## Spacing

- Prefer **tight, editorial spacing**
- Avoid excessive vertical gaps
- Sections should feel connected, not floating
- Reduce whitespace before adding new structure

## Above-the-fold rule

For critical pages (Discover, Hero):

- Primary interaction MUST be visible without scroll
- Do NOT push key UI below the fold

---

# 3. Design Fidelity Rule (CRITICAL)

When a reference image or design is provided:

- Treat it as **exact specification**
- Do NOT reinterpret layout
- Do NOT simplify structure
- Do NOT redesign components
- Match visually FIRST, then refine

If implementation differs from reference:

→ **Reference is correct**

---

# 4. Typography System (ENFORCED)

## Type roles

### Display (Editorial)
- Serif only
- Used for:
  - Page titles
  - Hero headlines
  - Section headers

### Body (UI)
- Sans-serif only
- Used for:
  - Navigation
  - Buttons
  - Labels
  - Metadata

## Rules

- Strong size contrast between headline and body
- Tight line-height on display text
- Metadata:
  - Uppercase
  - Increased letter spacing

## Do NOT

- Mix type roles incorrectly
- Use uniform font sizing
- Over-scale body text

---

# 5. Image System (CORE PRODUCT RULE)

Images are the product.

## Rules

- Images MUST dominate layout
- Never use uniform grids by default
- Always create hierarchy:
  - Primary image = larger
  - Supporting images = smaller

## Avoid

- File manager layouts
- Equal thumbnail grids
- Heavy borders or chrome

---

# 6. Discover Page — Card Stack (LOCKED)

This is a **fixed interaction pattern**.

## Layout

- Cards overlap horizontally
- Center card:
  - Largest
  - Fully opaque
  - Highest z-index

- Side cards:
  - Scaled down
  - Slightly faded
  - Still clearly visible

## Opacity

- Minimum opacity: **0.45**
- Never overly fade cards

## Transform system

- Use translateX + scale
- Do NOT switch to grid or flex layouts

---

# 7. Discover Navigation (STRICT)

## Arrows

- Must sit **outside card stack**
- Never overlap images
- Positioned relative to stack container

## Positioning

- Left arrow → left edge of stack
- Right arrow → right edge of stack
- Vertically centered to stack

## Behavior

- Clicking moves stack
- Maintain smooth transitions
- No layout jumps

---

# 8. Buttons System

## Primary
- Dark background
- Light text
- Used for:
  - Generate
  - Continue
  - Confirm actions

## Accent
- Terracotta
- Used sparingly:
  - Try free
  - Upgrade

## Secondary
- Transparent or soft surface
- Subtle border

## Rules

- No excessive shadows
- No bright colors
- Maintain calm premium feel

---

# 9. Component Philosophy

Claude must:

- Extend existing components
- Avoid creating parallel systems
- Avoid duplication

## Shared primitives (expected)

- PageShell
- Button
- Card
- Pill
- ImageCard
- EditorialImageRow

---

# 10. Architecture Rules

## Locked stack :contentReference[oaicite:0]{index=0}

- Next.js App Router
- TypeScript strict
- Tailwind + shadcn

## AI + APIs

- All AI calls go through `lib/ai/*`
- Never call external APIs directly from UI

## Data

- Persist before returning results
- No orphan records

## Third-party webhooks (LOCKED)

The Vercel Domains panel auto-redirects apex `vesperdrop.com` → `www.vesperdrop.com`
with HTTP 308. Stripe, Resend, GitHub, and most webhook senders do NOT follow
redirects — a 308 response is treated as delivery failure. Symptom: silent
webhook outage with no errors in our server logs (the handler is never
invoked).

Rules:
- **Always register webhook URLs against `https://www.vesperdrop.com/...`,
  never the apex.** Applies to Stripe, Resend, GitHub, Slack, and any
  future third-party caller.
- When debugging "events stopped firing on date X," first query
  `stripe_events` (or the equivalent idempotency log) for the last
  recorded `processed_at`. If it predates the reported outage and the
  handler code is unchanged, suspect a host/redirect mismatch before
  touching code.
- If you ever change the canonical host (apex ↔ www) in Vercel Domains,
  audit every external webhook receiver and update the registered URL
  in the same change.

---

# 11. Implementation Rules

## Required workflow

Before coding:

1. Inspect current implementation
2. Identify what already matches
3. Identify gaps
4. Modify ONLY necessary files

## Idempotency

- Do NOT rewrite pages
- Do NOT duplicate components
- Do NOT introduce new layout systems

---

# 12. Allowed vs Forbidden Changes

## Allowed

- Spacing adjustments
- Typography refinement
- Position corrections

## Forbidden

- Layout rewrites
- New UI paradigms
- Changing interaction models
- Replacing existing systems

---

# 13. Visual QA Checklist (MANDATORY)

Every page must pass:

- Is layout centered?
- Is width constrained?
- Are images dominant?
- Is hierarchy clear?
- Is typography strong?
- Does it avoid generic SaaS feel?

---

# 14. UX System (HIGH LEVEL)

## Flow principle

- Show value BEFORE asking for signup
- Reduce decisions
- Keep momentum

## Navigation

- One primary CTA
- Avoid competing actions

---

# 15. Conversion Rules

- Pro plan is dominant
- Free plan is visually de-emphasized
- Credit system must feel simple

---

# 15-Admin. Admin Entitlement (LOCKED)

**Admins get every paid feature, full stop.** Anywhere we gate a feature
on `plan !== "free"` or `isPaidPlanSlug(plan)`, the same condition must
also pass when `isAdminEmail(user.email)` is true — independent of what
`profiles.plan` says.

- Allowlist lives in `src/lib/admin.ts` (`ADMIN_EMAILS`). Current
  entries: `gblazer@gmail.com`, `info@slavablazer.com`. To add an
  admin, edit that file and ship — there is no DB-backed admin role.
- Concrete behaviors admins must NEVER hit:
  - `Downloads are a paid perk` upsell modal
    (`UpgradeRequiredDialog`) — 402 from `/api/images/[id]?download=1`.
  - Watermark on served images (`/api/images/[id]` watermark branch).
  - Quota-exhausted blocks if an admin is on the free plan with a
    drained `quota_units_balance` — admins are unmetered.
- When adding any new paid-only feature, write the gate as
  `isAdmin || isPaidPlanSlug(plan)` (or equivalent). Reviewing a PR
  with a bare `plan !== "free"` check on a paid surface → blocker.
- Drift between Stripe and `profiles.plan` (webhook miss, etc.) will
  still block a real paid customer. Admins are the safety net while
  drift is being investigated, but the underlying webhook bug is the
  real fix.

---

# 15a. Free-tier Funnel (LOCKED — revised 2026-05-18)

These are the canonical rules for the unauth /try flow. Do NOT change
ratios or copy without explicit instruction — they're tied to the
homepage hero, the inline email-capture moment in /try, and the Pro
upsell plumbing.

The previous version of this section (locked Indexes 1, 2 behind a
$9.99 per-image unlock) was retired in the conversion-sprint brief
on 2026-05-18: the campaign needed every scrap of email capture, and
$9.99 unlocks on watermarked previews were a friction speed-bump in
front of email collection. All 3 watermark-free outputs are now
delivered as the email-capture reward.

## Scene cap

- **Unauth visitors: max 3 scenes per batch.**
  - All 3 generate as **watermarked previews** anonymously (no email
    required) so the visitor sees output quality up front.
  - Submitting the inline email gate (`/api/try/email-photo`) unlocks
    **all 3 watermark-free HD versions** — delivered both on-screen
    and via Resend transactional email.
- Authed visitors: up to 6 scenes per batch.
- Enforced client-side in `try-flow.tsx` (`MAX_TRY_SCENES_UNAUTH = 3`)
  AND server-side in `/api/try/finalize-batch` (`maxScenes = userId ? 6 : 3`).
  Both layers required — never rely on the client cap alone.

## Monetization moments

- **Email** is the primary unauth conversion event — the email gate
  fires `fbq('track','Lead')` on server-confirmed success and writes a
  `try_intents` row. This is the moment ads optimize against.
- **Pro plan** ($39/mo) is the post-email upsell, surfaced as a teaser
  of additional unseen scenes ("Available with Pro · $39/mo"). The
  per-image $9.99 Stripe SKU stays in the DB for the authed re-unlock
  path and historical webhooks, but is **no longer used in /try state
  A/B/C upsell cards** — those cards either drive Pro signup or get
  removed.
- "Complete the studio" / "Complete the studio set" copy is deprecated
  on the unauth funnel. Replace with "All 3 photos · free with email"
  on State A/B/C, OR remove the upsell card and let the inline email
  gate carry the conversion.

## Locked copy

- **Headline language**: "first photo free" / "first one's free" —
  matches `lessons.md`. Never "free trial" anywhere on the site.
- **CTA**: "Get my first photo free →" (note "my", not "your" — the
  ads brief specified this; tested better in cold ad copy).
- **Risk reversal**: "No card required" / "First photo's on us"
  must appear visibly near every primary CTA.
- "Out of free renders" — error headline when `credit_limit_reached`
  fires. Never "Free batch used".

## What 15a does NOT cover

- The Pixel ID, ad event mapping, and Resend domain config live in
  env vars + Vercel project settings; do not hardcode.
- Pricing pages (`/pricing`) still display $19/$39/$99/$499 tier
  pricing — that's the authed/paid path and is not affected by the
  unauth-funnel rewrite.

---

# 16. Final Constraint

Claude must prioritize:

1. Layout correctness
2. Visual hierarchy
3. Interaction fidelity
4. System consistency

NOT creativity.

---

# END