# Mobile UI Overhaul + TDD Skill — Design Spec

**Date:** 2026-05-22  
**Issues:** VES-5 (parent), VES-6, VES-7, VES-8  
**Status:** Approved, pending implementation plan

---

## 1. Testing Skill

### Goal

Enforce TDD for all new code in this repo. No implementation ships without a failing test written first and a passing test suite confirmed before "done" is claimed.

### Skill file

`.agents/skills/tdd-vesperdrop.md` (project-local, not global)

### What the skill mandates

1. **Before any implementation file is touched:** create or open the test file for the unit/component being built. Write tests that encode the acceptance criteria from the Linear issue.
2. **Run `pnpm test` — confirm tests are failing** for the right reason (missing feature, not broken setup).
3. **Implement** the feature file by file until the tests pass.
4. **Run `pnpm test` again** — paste the full pass output as evidence before claiming the task done.

### Stack-specific patterns the skill must document

- **Server components** can't be rendered directly in jsdom — extract logic into a child client component and test that instead. The server component is just a data-fetching shell.
- **next/navigation mocks:** `vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/'), useRouter: vi.fn(() => ({ push: vi.fn() })) }))`
- **Supabase auth mock:** mock `@/lib/supabase/server` or use the existing pattern in `route.test.ts` files (they use a shared mock factory).
- **Breakpoint-sensitive behavior:** use `Object.defineProperty(window, 'matchMedia', ...)` or test the conditional logic at the component level via props (e.g., pass an `isMobile` prop in tests).
- **RTL baseline:** render → assert presence/absence of key elements → fire user events → assert state change.

---

## 2. VES-7 — Mobile Hero Compression

**File:** `src/components/marketing/hero.tsx`  
**Effort:** ~1 hour  
**Priority:** High

### Changes

| Element | Mobile (< md) | Desktop (md+) |
|---|---|---|
| H1 font size | `clamp(2rem, 5vw, 4.5rem)` | `clamp(2.5rem, 6vw, 4.5rem)` (unchanged) |
| H1 copy | "Apparel photos that look premium." | "Lifestyle photography that makes your apparel look premium." |
| Subhead | Hidden — text merged into caption | Visible (unchanged) |
| "See how it works" CTA | Hidden (`md:inline-flex`) | Visible (unchanged) |
| Caption | "Get your first photo free. No card required." | "First one's on us · No card · No spam" (unchanged) |
| Stat strip | Below the carousel | Between hero block and carousel (current position, unchanged) |

### Implementation approach

- Single `<h1>` element; mobile text wrapped in `<span className="md:hidden">`, desktop text wrapped in `<span className="hidden md:inline">`.
- Subhead `<p>` gets `hidden md:block`.
- "See how it works" link gets `hidden md:inline-flex` (or `md:flex` matching its current flex context).
- Stat strip `<dl>` moves below `<BeforeAfterCarousel />` in JSX render order, with `md:order-first` or a flex-column reorder.

### Tests

`src/components/marketing/hero.test.tsx` — new file

- Renders without crashing
- Desktop H1 text is present in DOM
- Mobile H1 text ("Apparel photos that look premium.") is present in DOM
- "See how it works" element has the `hidden md:inline-flex` class (verifying it exists but is mobile-hidden)
- Stat strip renders after the carousel in DOM order

### Acceptance criteria (from VES-7)

- [ ] At 390×700, header + eyebrow + H1 + CTA + first carousel image all visible without scrolling
- [ ] Mobile H1: "Apparel photos that look premium."
- [ ] Desktop H1 unchanged
- [ ] Only one `<h1>` at any breakpoint
- [ ] "See how it works" hidden on mobile, present on desktop
- [ ] Stat strip below carousel on mobile
- [ ] No desktop regression

---

## 3. VES-6 — Mobile Nav Sheet

**Files:** `src/components/nav.tsx` (modified), `src/components/mobile-nav-sheet.tsx` (new)  
**Effort:** ~3 hours  
**Priority:** Urgent

### Top bar layout at < md

```
unauth:  [≡]  Vesperdrop   [First photo free →]
authed:  [≡]  Vesperdrop   Photos·12  [A]
```

### Sheet contents

```
unauth:                    authed:
First photo free →  (CTA)  Library
                            Styles
Discover                    Account
Pricing                     Discover
How it works                Pricing
                            Admin (if isAdmin)
Sign in                    ────────
                            Photos: 12 · Free plan
                            Sign out
```

### Implementation

- **New component:** `src/components/mobile-nav-sheet.tsx` — `"use client"` component. Accepts: `isSignedIn`, `credits`, `isAdmin`, `firstName`, `email` as props from the server-rendered `Nav`.
- **Base primitive:** Radix `Dialog` from `src/components/ui/dialog.tsx` — already installed. Position content as `right-0 inset-y-0 w-[88%] max-w-sm` with slide-in animation (`translate-x-full` → `translate-x-0`).
- **Sheet close on route change:** `useEffect` watching `usePathname()`.
- **Nav.tsx changes:**
  - Add `<MobileNavSheet ... />` trigger + sheet, wrapped in `md:hidden`.
  - Remove `hidden` from credit chip when authed (make it `md:inline-flex` → visible on mobile too).
  - CTA button: shorten to "Try free" on very narrow or keep "First photo free →" with `whitespace-nowrap text-[13px] px-3.5 py-2`.

### Tests

`src/components/mobile-nav-sheet.test.tsx` — new file

- Renders hamburger button
- Clicking hamburger opens the sheet
- Sheet contains all expected nav links for unauth state
- Sheet contains all expected nav links for authed state (Library, Styles, Account, etc.)
- Sheet contains Admin link when `isAdmin=true`, hides it when `isAdmin=false`
- Sheet closes when `usePathname` changes (mock the hook, change value, assert sheet closed)
- Credit chip renders with correct count when authed

### Acceptance criteria (from VES-6)

- [ ] Hamburger visible at < md, hidden at md+
- [ ] Tap → sheet slides in from right; backdrop/close dismisses
- [ ] Sheet closes on route change
- [ ] All nav destinations reachable from sheet in both auth states
- [ ] Authed mobile: credit balance visible in top bar
- [ ] No layout shift in desktop nav
- [ ] Tap targets ≥ 44px tall

---

## 4. VES-8 — Mobile Carousel Single-Card Before/After Toggle

**File:** `src/components/marketing/before-after-carousel.tsx` (refactored)  
**Effort:** ~3 hours  
**Priority:** High

### Layout

```
mobile (< md):                        desktop (md+):
┌───────────────────────────┐         ┌─────────┐ ┌─────────┐
│                           │         │  Before  │ │  After  │
│   After (default)         │         │          │ │         │
│   full width, 4:5         │         └─────────┘ └─────────┘
│                           │         (unchanged)
│  [After] | [Before]  →    │
└───────────────────────────┘
  Cami · Velvet glow     1/4
    • • • •
```

### Implementation

- **`BeforeAfterCard`** gets internal `showBefore` state (default `false`). On mobile, renders one card at a time. On desktop, renders both side-by-side (no state needed — both visible).
- **Toggle pill:** `<button>` group "After | Before" below the image on mobile. `aria-pressed` on the active side.
- **Drag reveal:** track `onPointerMove` on the card; compute `x / width * 100` percent; apply `clipPath: inset(0 0 0 ${pct}%)` on the After layer sitting above the Before. Pointer capture via `setPointerCapture` for smooth drag outside the element.
- **`showBefore` per-slide:** state lives in `BeforeAfterCarousel` as `Record<number, boolean>`, keyed by index. Switching slides does not reset other slides.
- **First-load hint:** small "tap to compare" pill fades after first interaction (`useState(true)` → `false` on first toggle; `opacity-0 pointer-events-none` after).
- **LCP:** After frame of slide 0 keeps `priority={true}` and `fetchPriority="high"`. Before of slide 0 and both frames of slides 1–3 are lazy.
- **Desktop layout:** `<div className="hidden md:grid md:grid-cols-2 ...">` wrapping both cards — unchanged from today.
- **Mobile layout:** `<div className="md:hidden">` wrapping the single-card + toggle UI.

### Tests

`src/components/marketing/before-after-carousel.test.tsx` — new file

- Renders without crashing
- Default state: shows "After" label/content
- Clicking "Before" toggle changes to Before
- Clicking "After" toggle reverts
- Switching slide index does not reset other slide's showBefore state
- "Vesperdrop" chip visible in After view, hidden in Before view
- First-load "tap to compare" hint present initially, gone after first toggle
- Keyboard: space/enter on toggle button fires the toggle

### Acceptance criteria (from VES-8)

- [ ] At 390px: one card per slide, ~360px wide, 4:5 ratio
- [ ] Tapping After/Before pill toggles view
- [ ] Drag slider line reveals the other image
- [ ] Dot nav and caption visible without further scroll
- [ ] At md+: current side-by-side layout intact
- [ ] Lighthouse mobile LCP: After frame of slide 1
- [ ] Keyboard accessible (tab to pill, space/enter toggles)
- [ ] No CLS — aspect-[4/5] reserved

---

## 5. Execution Order

Issues are independent (no shared files between VES-6, VES-7, VES-8 after the nav.tsx/hero.tsx split). All three can run in parallel agents.

| Agent | Issue | Files touched |
|---|---|---|
| Agent A | VES-7 | `hero.tsx`, `hero.test.tsx` (new) |
| Agent B | VES-6 | `nav.tsx`, `mobile-nav-sheet.tsx` (new), `mobile-nav-sheet.test.tsx` (new) |
| Agent C | VES-8 | `before-after-carousel.tsx`, `before-after-carousel.test.tsx` (new) |
| Skill author | Testing skill | `.agents/skills/tdd-vesperdrop.md` (new) |

Each agent follows TDD: write failing tests → implement → green suite → done.

---

## 6. Out of Scope

- Playwright e2e tests (not in scope per user decision — Vitest RTL only)
- Auto-rotate/autoplay on carousel
- Adding a 5th garment pair
- Desktop layout changes on any surface
