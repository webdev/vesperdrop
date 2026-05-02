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

# 16. Final Constraint

Claude must prioritize:

1. Layout correctness
2. Visual hierarchy
3. Interaction fidelity
4. System consistency

NOT creativity.

---

# END