# Mobile UI Overhaul + TDD Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship mobile navigation sheet (VES-6), hero compression (VES-7), and carousel before/after toggle (VES-8) using TDD; also create a project-local TDD skill.

**Architecture:** Four independent workstreams (S, A, B, C) — no shared files, all can execute in parallel. Each follows red-green-commit TDD: test file first, failing run, implementation, green run, commit.

**Tech Stack:** Next.js App Router, Vitest + React Testing Library (`@testing-library/react`), Tailwind CSS, `@base-ui/react/dialog`, TypeScript strict.

---

## File Map

| Status | File | Workstream |
|---|---|---|
| Create | `.agents/skills/tdd-vesperdrop.md` | S |
| Create | `src/components/mobile-nav-sheet.tsx` | B |
| Create | `src/components/mobile-nav-sheet.test.tsx` | B |
| Create | `src/components/marketing/hero.test.tsx` | A |
| Create | `src/components/marketing/before-after-carousel.test.tsx` | C |
| Modify | `src/components/nav.tsx` | B |
| Modify | `src/components/marketing/hero.tsx` | A |
| Modify | `src/components/marketing/before-after-carousel.tsx` | C |

---

## WORKSTREAM S — TDD Skill

### Task S1: Create project-local TDD skill

**Files:**
- Create: `.agents/skills/tdd-vesperdrop.md`

- [ ] **Step S1.1: Write the skill file**

```bash
mkdir -p .agents/skills
```

Then create `.agents/skills/tdd-vesperdrop.md`:

```markdown
---
name: tdd-vesperdrop
description: Enforces TDD for this project. Write failing tests first, confirm red, implement to green, paste pass output before claiming done.
metadata:
  type: feedback
---

# TDD Skill — Vesperdrop

## The Rule

Before touching any implementation file:
1. Create or open the test file
2. Write tests encoding the acceptance criteria from the Linear issue
3. Run `pnpm test` — confirm tests FAIL for the right reason (missing feature, not setup error)
4. Implement the feature until tests go green
5. Run `pnpm test` again — paste the pass output as evidence before claiming done

## Running tests

```bash
pnpm test                                           # full suite
pnpm test src/path/to/file.test.tsx                 # single file
pnpm test src/path/to/file.test.tsx --reporter=verbose  # verbose output
```

## React component test baseline

```ts
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MyComponent } from "./MyComponent";

afterEach(cleanup);
```

## Mocking next/navigation

```ts
const mockPathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));
```

## Mocking @base-ui/react/dialog (for components using Dialog primitives)

```ts
vi.mock("@base-ui/react/dialog", () => ({
  Dialog: {
    Root: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Trigger: ({ children, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
      <button {...props}>{children}</button>
    ),
    Portal: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Backdrop: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
    Popup: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
    Close: ({ children, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
      <button {...props}>{children}</button>
    ),
  },
}));
```

## Mocking next/image

```ts
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
```

## Mocking Supabase server client

```ts
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));
```

## Mocking child components (to isolate the component under test)

```ts
vi.mock("./SomeChildComponent", () => ({
  SomeChildComponent: () => <div data-testid="child-mock" />,
}));
```

## Server components in tests

Server components (no `"use client"`) are sync functions — render them directly with RTL. Async server components need extracting into a child client component to test the logic separately.

## Breakpoint behavior in jsdom

jsdom has no CSS media queries. Verify breakpoint-conditional behavior by:
- Checking that elements have the expected Tailwind class via `element.className.includes("hidden")`
- Testing the component's JS-level logic (state, props) not the CSS outcome
- Visual/CSS breakpoint correctness is verified by a human or a Playwright test

## Definition of Done

A task is NOT done until:
- [ ] All tests pass (`pnpm test` shows 0 failures)
- [ ] Test output pasted as evidence (the pass line with test counts)
- [ ] No new `console.error` or `console.warn` in test output caused by your code
```

- [ ] **Step S1.2: Commit**

```bash
git add .agents/skills/tdd-vesperdrop.md
git commit -m "feat(skill): add project-local TDD skill"
```

---

## WORKSTREAM A — VES-7: Mobile Hero Compression

### Task A1: Write failing hero tests

**Files:**
- Create: `src/components/marketing/hero.test.tsx`

- [ ] **Step A1.1: Write the test file**

Create `src/components/marketing/hero.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Hero } from "./hero";

afterEach(cleanup);

vi.mock("./before-after-carousel", () => ({
  BeforeAfterCarousel: () => <div data-testid="carousel-mock" />,
}));

describe("Hero — mobile compression (VES-7)", () => {
  it("renders exactly one <h1>", () => {
    render(<Hero />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("h1 contains the mobile copy", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Apparel photos that look/i,
    );
  });

  it("h1 contains the desktop copy", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Lifestyle photography that makes your apparel look/i,
    );
  });

  it("'See how it works' link has the hidden class (mobile-hidden)", () => {
    render(<Hero />);
    const link = screen.getByRole("link", { name: /see how it works/i });
    expect(link.className).toContain("hidden");
    expect(link.className).toContain("md:inline-flex");
  });

  it("renders the carousel before the stat strip in DOM order", () => {
    const { container } = render(<Hero />);
    const carousel = screen.getByTestId("carousel-mock");
    const dl = container.querySelector("dl");
    expect(dl).not.toBeNull();
    // carousel must come before the stat strip dl
    expect(
      carousel.compareDocumentPosition(dl!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("primary CTA links to /try", () => {
    render(<Hero />);
    expect(
      screen.getByRole("link", { name: /get my first photo free/i }),
    ).toHaveAttribute("href", "/try");
  });
});
```

- [ ] **Step A1.2: Run — confirm tests fail**

```bash
pnpm test src/components/marketing/hero.test.tsx
```

Expected output: several FAIL lines — `hero.test.tsx` doesn't have mobile copy spans or `hidden md:inline-flex` on "See how it works" yet.

### Task A2: Implement hero changes

**Files:**
- Modify: `src/components/marketing/hero.tsx`

- [ ] **Step A2.1: Replace hero.tsx**

Full replacement for `src/components/marketing/hero.tsx`:

```tsx
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { BeforeAfterCarousel } from "./before-after-carousel";

export function Hero() {
  return (
    <section className="relative">
      <Container width="marketing" className="pb-12 pt-8 md:pb-20 md:pt-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3 md:text-[11px]">
            For Etsy, Shopify &amp; Amazon apparel sellers
          </p>

          {/* Single <h1>; mobile and desktop copy use CSS visibility, not duplicate tags. */}
          <h1 className="mt-4 text-[clamp(2rem,5vw,4.5rem)] font-serif leading-[1.02] tracking-[-0.02em] text-ink md:mt-5 md:text-[clamp(2.5rem,6vw,4.5rem)]">
            <span className="md:hidden">
              Apparel photos that look{" "}
              <em className="not-italic font-serif italic text-terracotta-dark">
                premium
              </em>
              .
            </span>
            <span className="hidden md:inline">
              Lifestyle photography that makes your apparel look{" "}
              <em className="not-italic font-serif italic text-terracotta-dark">
                premium
              </em>
              .
            </span>
          </h1>

          {/* Subhead hidden on mobile — caption carries the risk reversal */}
          <p className="mt-5 hidden max-w-xl text-[16px] leading-[1.55] text-ink-3 md:block">
            Get your first photo free. No card required.
          </p>

          <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center md:mt-7">
            <Link
              href="/try"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark md:py-3.5"
            >
              Get my first photo free
              <span aria-hidden>→</span>
            </Link>
            {/* Hidden on mobile — lowest-value CTA above the fold */}
            <Link
              href="#how"
              className="hidden items-center justify-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2 md:inline-flex"
            >
              See how it works
            </Link>
          </div>

          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
            First one&rsquo;s on us &middot; No card &middot; No spam
          </p>
        </div>

        <div className="mt-10 md:mt-16">
          <BeforeAfterCarousel />
        </div>

        <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 border-t border-line-soft pt-6 sm:grid-cols-4 md:mt-16">
          <Stat label="Per batch" value="6 photos" />
          <Stat label="Time" value="~90 sec" />
          <Stat label="Marketplace" value="A+ ready" />
          <Stat label="Pro from" value="$39/mo" />
        </dl>
      </Container>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
        {label}
      </dt>
      <dd className="mt-1.5 font-serif text-[20px] leading-none tracking-[-0.01em] text-ink">
        {value}
      </dd>
    </div>
  );
}
```

### Task A3: Run tests and commit

- [ ] **Step A3.1: Run hero tests — confirm they pass**

```bash
pnpm test src/components/marketing/hero.test.tsx
```

Expected: `6 tests | 6 passed`

- [ ] **Step A3.2: Run full suite — check for regressions**

```bash
pnpm test
```

Expected: No new failures.

- [ ] **Step A3.3: Commit**

```bash
git add src/components/marketing/hero.tsx src/components/marketing/hero.test.tsx
git commit -m "feat(mobile): compress hero — shorter H1, hide secondary CTA on mobile (VES-7)"
```

---

## WORKSTREAM B — VES-6: Mobile Nav Sheet

### Task B1: Write failing nav sheet tests

**Files:**
- Create: `src/components/mobile-nav-sheet.test.tsx`

- [ ] **Step B1.1: Write the test file**

Create `src/components/mobile-nav-sheet.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MobileNavSheet } from "./mobile-nav-sheet";

afterEach(cleanup);

const mockPathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// base-ui Dialog doesn't run in jsdom — replace primitives with plain HTML wrappers.
vi.mock("@base-ui/react/dialog", () => ({
  Dialog: {
    Root: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Trigger: ({
      children,
      ...props
    }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
      <button {...props}>{children}</button>
    ),
    Portal: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Backdrop: ({
      children,
      ...props
    }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
    Popup: ({
      children,
      ...props
    }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
    Close: ({
      children,
      ...props
    }: React.PropsWithChildren<
      React.ButtonHTMLAttributes<HTMLButtonElement>
    >) => <button {...props}>{children}</button>,
  },
}));

describe("MobileNavSheet — content (VES-6)", () => {
  it("renders a hamburger trigger button", () => {
    render(
      <MobileNavSheet
        isSignedIn={false}
        credits={null}
        isAdmin={false}
        firstName={null}
        email=""
      />,
    );
    expect(screen.getByTestId("hamburger-button")).toBeInTheDocument();
  });

  describe("unauth state", () => {
    beforeEach(() => {
      render(
        <MobileNavSheet
          isSignedIn={false}
          credits={null}
          isAdmin={false}
          firstName={null}
          email=""
        />,
      );
    });

    it("shows 'First photo free' CTA link", () => {
      expect(
        screen.getByRole("link", { name: /first photo free/i }),
      ).toBeInTheDocument();
    });

    it("shows Discover link", () => {
      expect(
        screen.getByRole("link", { name: /discover/i }),
      ).toBeInTheDocument();
    });

    it("shows Pricing link", () => {
      expect(
        screen.getByRole("link", { name: /pricing/i }),
      ).toBeInTheDocument();
    });

    it("shows 'How it works' link", () => {
      expect(
        screen.getByRole("link", { name: /how it works/i }),
      ).toBeInTheDocument();
    });

    it("shows Sign in link", () => {
      expect(
        screen.getByRole("link", { name: /sign in/i }),
      ).toBeInTheDocument();
    });

    it("does NOT show Library, Styles, or Account links", () => {
      expect(screen.queryByRole("link", { name: /^library$/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /^styles$/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /^account$/i })).toBeNull();
    });
  });

  describe("authed, non-admin", () => {
    beforeEach(() => {
      render(
        <MobileNavSheet
          isSignedIn={true}
          credits={12}
          isAdmin={false}
          firstName="Alice"
          email="alice@example.com"
        />,
      );
    });

    it("shows Library, Styles, Account, Discover, Pricing", () => {
      expect(
        screen.getByRole("link", { name: /^library$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /^styles$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /^account$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /^discover$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /^pricing$/i }),
      ).toBeInTheDocument();
    });

    it("does NOT show Admin link", () => {
      expect(screen.queryByRole("link", { name: /^admin$/i })).toBeNull();
    });

    it("shows credit count in footer", () => {
      expect(screen.getByTestId("sheet-footer")).toHaveTextContent("12");
    });

    it("shows Sign out button", () => {
      expect(
        screen.getByRole("button", { name: /sign out/i }),
      ).toBeInTheDocument();
    });
  });

  describe("authed, admin", () => {
    beforeEach(() => {
      render(
        <MobileNavSheet
          isSignedIn={true}
          credits={null}
          isAdmin={true}
          firstName="George"
          email="gblazer@gmail.com"
        />,
      );
    });

    it("shows Admin link when isAdmin=true", () => {
      expect(
        screen.getByRole("link", { name: /^admin$/i }),
      ).toBeInTheDocument();
    });

    it("shows ∞ in footer for admins", () => {
      expect(screen.getByTestId("sheet-footer")).toHaveTextContent("∞");
    });
  });

  it("usePathname is called (so route-change close effect is wired)", () => {
    render(
      <MobileNavSheet
        isSignedIn={false}
        credits={null}
        isAdmin={false}
        firstName={null}
        email=""
      />,
    );
    expect(mockPathname).toHaveBeenCalled();
  });
});
```

- [ ] **Step B1.2: Run — confirm tests fail**

```bash
pnpm test src/components/mobile-nav-sheet.test.tsx
```

Expected: FAIL — module `./mobile-nav-sheet` not found.

### Task B2: Create `mobile-nav-sheet.tsx`

**Files:**
- Create: `src/components/mobile-nav-sheet.tsx`

- [ ] **Step B2.1: Write the component**

Create `src/components/mobile-nav-sheet.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

type Props = {
  isSignedIn: boolean;
  credits: number | null;
  isAdmin: boolean;
  firstName: string | null;
  email: string;
};

export function MobileNavSheet({
  isSignedIn,
  credits,
  isAdmin,
  firstName,
  email,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className="flex h-11 w-11 items-center justify-center text-ink"
        aria-label="Open navigation"
        data-testid="hamburger-button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={20}
          height={20}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <line x1="3" y1="6" x2="17" y2="6" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="14" x2="17" y2="14" />
        </svg>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs"
          onClick={() => setOpen(false)}
        />
        <DialogPrimitive.Popup className="fixed inset-y-0 right-0 z-50 flex w-[88%] max-w-sm flex-col bg-paper shadow-xl">
          {/* Sheet header */}
          <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
            <span className="font-serif text-[18px] font-medium tracking-tight text-ink">
              Vesperdrop
            </span>
            <DialogPrimitive.Close
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface hover:text-ink"
              aria-label="Close navigation"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={16}
                height={16}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <line x1="3" y1="3" x2="13" y2="13" />
                <line x1="13" y1="3" x2="3" y2="13" />
              </svg>
            </DialogPrimitive.Close>
          </div>

          {/* Navigation links */}
          <nav
            className="flex flex-col px-4 py-4"
            aria-label="Mobile navigation"
            data-testid="sheet-nav"
          >
            {isSignedIn ? (
              <>
                <SheetLink href="/app/library">Library</SheetLink>
                <SheetLink href="/app">Styles</SheetLink>
                <SheetLink href="/account">Account</SheetLink>
                <SheetLink href="/discover">Discover</SheetLink>
                <SheetLink href="/pricing">Pricing</SheetLink>
                {isAdmin ? (
                  <SheetLink href="/admin/etsy-candidates">Admin</SheetLink>
                ) : null}
              </>
            ) : (
              <>
                <Link
                  href="/try"
                  className="mb-4 inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-5 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
                >
                  First photo free →
                </Link>
                <SheetLink href="/discover">Discover</SheetLink>
                <SheetLink href="/pricing">Pricing</SheetLink>
                <SheetLink href="/#how">How it works</SheetLink>
                <SheetLink href="/sign-in">Sign in</SheetLink>
              </>
            )}
          </nav>

          {/* Footer — authed users only */}
          {isSignedIn ? (
            <div
              className="mt-auto border-t border-line-soft px-5 py-5"
              data-testid="sheet-footer"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                Photos:{" "}
                <span className="text-ink">
                  {isAdmin ? "∞" : (credits ?? 0)}
                </span>
                {" · "}
                {isAdmin ? "Admin" : (firstName ?? email)}
              </p>
              <form action="/api/auth/sign-out" method="post" className="mt-4">
                <button
                  type="submit"
                  className="py-1 text-[14px] text-ink-3 transition-colors hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SheetLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block py-3 text-[16px] text-ink-2 transition-colors hover:text-ink"
    >
      {children}
    </Link>
  );
}
```

### Task B3: Modify `nav.tsx`

**Files:**
- Modify: `src/components/nav.tsx`

- [ ] **Step B3.1: Replace nav.tsx**

Full replacement for `src/components/nav.tsx`:

```tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container, type ContainerWidth } from "@/components/ui/container";
import { NavLink } from "@/components/ui/nav-link";
import { firstNameFrom } from "@/lib/user-display";
import { getQuotaBalance } from "@/lib/db/quota";
import { isAdminEmail } from "@/lib/admin";
import { MobileNavSheet } from "@/components/mobile-nav-sheet";

type NavProps = {
  width?: ContainerWidth;
};

export async function Nav({ width = "app" }: NavProps = {}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = !!user;
  const firstName = user ? firstNameFrom(user) : null;
  const credits = user ? await getQuotaBalance(user.id) : null;
  const email = user?.email ?? "";
  const isAdmin = isAdminEmail(email);

  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-paper/85 backdrop-blur-md">
      <Container
        width={width}
        className="flex items-center gap-3 py-4 md:gap-10"
      >
        {/* Mobile hamburger — hidden above md */}
        <div className="md:hidden">
          <MobileNavSheet
            isSignedIn={isSignedIn}
            credits={credits}
            isAdmin={isAdmin}
            firstName={firstName}
            email={email}
          />
        </div>

        <Link
          href={isSignedIn ? "/app" : "/"}
          className="font-serif text-[22px] font-medium tracking-tight text-ink"
        >
          Vesperdrop
        </Link>

        {/* Desktop primary nav */}
        <nav
          aria-label="Primary"
          className="hidden flex-1 items-center gap-8 text-[14px] text-ink-3 md:flex"
        >
          <NavLink href="/discover">Discover</NavLink>
          {isSignedIn ? (
            <>
              <NavLink href="/app/library">Library</NavLink>
              <NavLink href="/app" exact matchPrefixes={["/app/runs"]}>
                Styles
              </NavLink>
              <NavLink href="/account">Account</NavLink>
              {isAdmin ? (
                <NavLink
                  href="/admin/etsy-candidates"
                  matchPrefixes={["/admin"]}
                >
                  Admin
                </NavLink>
              ) : null}
            </>
          ) : (
            <Link
              href="/#how"
              className="py-1 text-ink-3 transition-colors hover:text-ink"
            >
              How it works
            </Link>
          )}
          <NavLink href="/pricing">Pricing</NavLink>
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {isSignedIn ? (
            <>
              {/* Credit chip — always visible (mobile users need to see this) */}
              {isAdmin ? (
                <span
                  aria-label="Unlimited photos"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2"
                >
                  Photos
                  <span className="text-ink">∞</span>
                </span>
              ) : typeof credits === "number" ? (
                <span
                  aria-label={`${credits} photos remaining`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2"
                >
                  Photos
                  <span className="text-ink">{credits}</span>
                </span>
              ) : null}
              <Link
                href="/account"
                className="hidden py-1 text-[14px] text-ink-3 transition-colors hover:text-ink md:inline"
                title={email}
              >
                {firstName ?? email}
              </Link>
              <form
                action="/api/auth/sign-out"
                method="post"
                className="hidden md:block"
              >
                <button
                  type="submit"
                  className="py-1 text-[14px] text-ink-3 transition-colors hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Sign in hidden on mobile — reachable via sheet */}
              <Link
                href="/sign-in"
                className="hidden py-1 text-[13px] text-ink-3 transition-colors hover:text-ink md:inline md:text-[14px]"
              >
                Sign in
              </Link>
              <Link
                href="/try"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-cream transition-colors hover:bg-ink-2 md:gap-2 md:px-5 md:text-[14px]"
              >
                <span className="sm:hidden">Try free</span>
                <span className="hidden sm:inline">First photo free</span>
                <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
```

### Task B4: Run tests and commit

- [ ] **Step B4.1: Run nav sheet tests — confirm they pass**

```bash
pnpm test src/components/mobile-nav-sheet.test.tsx
```

Expected: `15 tests | 15 passed`

- [ ] **Step B4.2: Run full suite**

```bash
pnpm test
```

Expected: No new failures.

- [ ] **Step B4.3: Commit**

```bash
git add src/components/mobile-nav-sheet.tsx \
        src/components/mobile-nav-sheet.test.tsx \
        src/components/nav.tsx
git commit -m "feat(mobile): hamburger nav sheet + credit chip always visible (VES-6)"
```

---

## WORKSTREAM C — VES-8: Mobile Carousel Before/After Toggle

### Task C1: Write failing carousel tests

**Files:**
- Create: `src/components/marketing/before-after-carousel.test.tsx`

- [ ] **Step C1.1: Write the test file**

Create `src/components/marketing/before-after-carousel.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BeforeAfterCarousel } from "./before-after-carousel";

afterEach(cleanup);

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

describe("BeforeAfterCarousel — mobile toggle (VES-8)", () => {
  it("renders without crashing", () => {
    render(<BeforeAfterCarousel />);
    expect(screen.getByTestId("mobile-card")).toBeInTheDocument();
  });

  it("shows After as active by default (aria-pressed=true on After btn)", () => {
    render(<BeforeAfterCarousel />);
    expect(
      screen.getByRole("button", { name: /show after/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /show before/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking Before toggles aria-pressed on both buttons", () => {
    render(<BeforeAfterCarousel />);
    fireEvent.click(screen.getByRole("button", { name: /show before/i }));
    expect(
      screen.getByRole("button", { name: /show before/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /show after/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking After reverts to After active", () => {
    render(<BeforeAfterCarousel />);
    fireEvent.click(screen.getByRole("button", { name: /show before/i }));
    fireEvent.click(screen.getByRole("button", { name: /show after/i }));
    expect(
      screen.getByRole("button", { name: /show after/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("preserves per-slide showBefore state across navigation", () => {
    render(<BeforeAfterCarousel />);

    // Toggle slide 0 → Before
    fireEvent.click(screen.getByRole("button", { name: /show before/i }));
    expect(
      screen.getByRole("button", { name: /show before/i }),
    ).toHaveAttribute("aria-pressed", "true");

    // Navigate to slide 1
    const dots = screen.getAllByRole("tab");
    fireEvent.click(dots[1]);

    // Slide 1 starts as After
    expect(
      screen.getByRole("button", { name: /show after/i }),
    ).toHaveAttribute("aria-pressed", "true");

    // Navigate back to slide 0 — should still be Before
    fireEvent.click(dots[0]);
    expect(
      screen.getByRole("button", { name: /show before/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("'tap to compare' hint is visible initially", () => {
    render(<BeforeAfterCarousel />);
    const hint = screen.getByTestId("compare-hint");
    expect(hint.className).toContain("opacity-100");
  });

  it("'tap to compare' hint fades after first toggle", () => {
    render(<BeforeAfterCarousel />);
    fireEvent.click(screen.getByRole("button", { name: /show before/i }));
    const hint = screen.getByTestId("compare-hint");
    expect(hint.className).toContain("opacity-0");
  });

  it("toggle buttons are <button> elements with aria-pressed (keyboard accessible)", () => {
    render(<BeforeAfterCarousel />);
    const afterBtn = screen.getByRole("button", { name: /show after/i });
    const beforeBtn = screen.getByRole("button", { name: /show before/i });
    expect(afterBtn.tagName).toBe("BUTTON");
    expect(beforeBtn.tagName).toBe("BUTTON");
    expect(afterBtn).toHaveAttribute("aria-pressed");
    expect(beforeBtn).toHaveAttribute("aria-pressed");
  });

  it("renders 4 dot-nav tabs", () => {
    render(<BeforeAfterCarousel />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("shows label and scene for the first slide", () => {
    render(<BeforeAfterCarousel />);
    // First slide: "Cami · Velvet glow"
    expect(screen.getByText(/cami/i)).toBeInTheDocument();
    expect(screen.getByText(/velvet glow/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step C1.2: Run — confirm tests fail**

```bash
pnpm test src/components/marketing/before-after-carousel.test.tsx
```

Expected: Several FAILs — `mobile-card` testid not found, toggle buttons don't exist.

### Task C2: Refactor `before-after-carousel.tsx`

**Files:**
- Modify: `src/components/marketing/before-after-carousel.tsx`

- [ ] **Step C2.1: Replace the file**

Full replacement for `src/components/marketing/before-after-carousel.tsx`:

```tsx
"use client";

import Image from "next/image";
import { useState, useRef } from "react";

type Pair = {
  slug: string;
  label: string;
  scene: string;
  before: string;
  after: string;
};

const PAIRS: Pair[] = [
  {
    slug: "cami",
    label: "Cami",
    scene: "Velvet glow",
    before: "/marketing/before-after/cami_before.webp",
    after: "/marketing/before-after/cami_after.webp",
  },
  {
    slug: "jacket",
    label: "Jacket",
    scene: "Urban canvas",
    before: "/marketing/before-after/jacket_before.webp",
    after: "/marketing/before-after/jacket_after.webp",
  },
  {
    slug: "skirt",
    label: "Skirt",
    scene: "Warm retreat",
    before: "/marketing/before-after/skirt_before.webp",
    after: "/marketing/before-after/skirt_after.webp",
  },
  {
    slug: "lace",
    label: "Lace",
    scene: "Studio athletic",
    before: "/marketing/before-after/lace_before.webp",
    after: "/marketing/before-after/lace_after.webp",
  },
];

export function BeforeAfterCarousel() {
  const [index, setIndex] = useState(0);
  // Per-slide before/after state — key is pair index, default false (After)
  const [showBeforeMap, setShowBeforeMap] = useState<Record<number, boolean>>(
    {},
  );
  const [hintDismissed, setHintDismissed] = useState(false);

  const pair = PAIRS[index];
  const showBefore = showBeforeMap[index] ?? false;

  function toggleBefore() {
    setShowBeforeMap((prev) => ({ ...prev, [index]: !(prev[index] ?? false) }));
    if (!hintDismissed) setHintDismissed(true);
  }

  return (
    <div className="flex flex-col items-center gap-4 md:gap-6">
      <figure className="w-full max-w-4xl">
        {/* Desktop: side-by-side (unchanged from original) */}
        <div className="hidden md:grid md:grid-cols-2 md:gap-5">
          <BeforeAfterCard
            kind="before"
            src={pair.before}
            alt={`${pair.label} — flat lay before Vesperdrop`}
            label="Before"
            priority={index === 0}
          />
          <BeforeAfterCard
            kind="after"
            src={pair.after}
            alt={`${pair.label} — on-model lifestyle photo, ${pair.scene.toLowerCase()}`}
            label="After"
            priority={index === 0}
          />
        </div>

        {/* Mobile: single card with toggle */}
        <div className="md:hidden" data-testid="mobile-card">
          <SingleCardToggle
            pair={pair}
            pairIndex={index}
            showBefore={showBefore}
            onToggle={toggleBefore}
            showHint={!hintDismissed}
          />
        </div>

        <figcaption className="mt-3 flex items-baseline justify-between gap-3 md:mt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
            {pair.label} · {pair.scene}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
            {index + 1} / {PAIRS.length}
          </p>
        </figcaption>
      </figure>

      <div
        className="flex items-center gap-2"
        role="tablist"
        aria-label="Before and after examples"
      >
        {PAIRS.map((p, i) => (
          <button
            key={p.slug}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show ${p.label} example`}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-8 bg-ink" : "w-2 bg-ink-4 hover:bg-ink-3"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

type SingleCardToggleProps = {
  pair: Pair;
  pairIndex: number;
  showBefore: boolean;
  onToggle: () => void;
  showHint: boolean;
};

function SingleCardToggle({
  pair,
  pairIndex,
  showBefore,
  onToggle,
  showHint,
}: SingleCardToggleProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragPct, setDragPct] = useState<number | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!cardRef.current || !(e.buttons & 1)) return;
    const rect = cardRef.current.getBoundingClientRect();
    const pct = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
    );
    setDragPct(pct);
  }

  function handlePointerUp() {
    if (dragPct !== null) {
      // Snap: drag left of center → Before, drag right of center → After
      const shouldShowBefore = dragPct < 50;
      if (shouldShowBefore !== showBefore) onToggle();
      setDragPct(null);
    }
  }

  // Live clip during drag; static state otherwise.
  // After image is on top; clip-path inset(0 0 0 X%) hides the left X%.
  // When showBefore: clip 0% (entire After hidden by 100% left inset means...
  // actually: to hide After and show Before, use clipPath inset(0 0 0 100%).
  // dragPct=0 → all After hidden (Before visible); dragPct=100 → all After visible.
  const afterClipLeft = dragPct !== null ? 100 - dragPct : showBefore ? 100 : 0;

  const isAfterActive = !showBefore;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={cardRef}
        className="relative aspect-[4/5] w-full max-w-sm overflow-hidden rounded-lg border border-line-soft bg-paper-2 shadow-soft"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Before — bottom layer */}
        <Image
          src={pair.before}
          alt={`${pair.label} — flat lay before Vesperdrop`}
          fill
          priority={pairIndex === 0 && showBefore}
          sizes="(min-width: 640px) 384px, calc(100vw - 40px)"
          quality={80}
          className="object-cover"
        />

        {/* After — top layer, clipped to reveal Before underneath */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: `inset(0 0 0 ${afterClipLeft}%)`,
            transition: dragPct !== null ? "none" : "clip-path 0.2s ease",
          }}
        >
          <Image
            src={pair.after}
            alt={`${pair.label} — on-model lifestyle photo, ${pair.scene.toLowerCase()}`}
            fill
            priority={pairIndex === 0}
            sizes="(min-width: 640px) 384px, calc(100vw - 40px)"
            quality={85}
            className="object-cover"
          />
          <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-ink/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cream backdrop-blur-sm">
            Vesperdrop
          </span>
        </div>

        {/* Before label — only when Before is showing */}
        {showBefore ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center rounded-full bg-cream/95 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink shadow-subtle">
            Before
          </span>
        ) : null}

        {/* "Tap to compare" hint — fades after first toggle */}
        <div
          data-testid="compare-hint"
          className={`pointer-events-none absolute bottom-12 left-0 right-0 flex justify-center transition-opacity duration-500 ${
            showHint ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="rounded-full bg-black/50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            Tap to compare
          </span>
        </div>
      </div>

      {/* After / Before toggle pill */}
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
        <button
          type="button"
          aria-label="Show after"
          aria-pressed={isAfterActive}
          onClick={() => {
            if (!isAfterActive) onToggle();
          }}
          className={`rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all ${
            isAfterActive ? "bg-ink text-cream" : "text-ink-3 hover:text-ink"
          }`}
        >
          After
        </button>
        <button
          type="button"
          aria-label="Show before"
          aria-pressed={showBefore}
          onClick={() => {
            if (!showBefore) onToggle();
          }}
          className={`rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all ${
            showBefore ? "bg-ink text-cream" : "text-ink-3 hover:text-ink"
          }`}
        >
          Before
        </button>
      </div>
    </div>
  );
}

function BeforeAfterCard({
  kind,
  src,
  alt,
  label,
  priority,
}: {
  kind: "before" | "after";
  src: string;
  alt: string;
  label: string;
  priority?: boolean;
}) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-line-soft bg-paper-2 shadow-soft">
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 480px, (min-width: 640px) 45vw, 50vw"
        quality={kind === "after" ? 85 : 80}
        className="object-cover"
      />
      <span className="absolute bottom-3 left-3 inline-flex items-center rounded-full bg-cream/95 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink shadow-subtle">
        {label}
      </span>
      {kind === "after" ? (
        <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-ink/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cream backdrop-blur-sm">
          Vesperdrop
        </span>
      ) : null}
    </div>
  );
}
```

### Task C3: Run tests and commit

- [ ] **Step C3.1: Run carousel tests — confirm they pass**

```bash
pnpm test src/components/marketing/before-after-carousel.test.tsx
```

Expected: `10 tests | 10 passed`

- [ ] **Step C3.2: Run full suite**

```bash
pnpm test
```

Expected: No new failures.

- [ ] **Step C3.3: Commit**

```bash
git add src/components/marketing/before-after-carousel.tsx \
        src/components/marketing/before-after-carousel.test.tsx
git commit -m "feat(mobile): single-card before/after toggle + drag reveal (VES-8)"
```

---

## Parallelization note

Workstreams A, B, C, and S touch **completely different files**. Dispatch them as simultaneous agents. The only ordering constraint: within each workstream, tasks are sequential (write tests → implement → commit).

## Final verification (after all workstreams complete)

```bash
pnpm test
pnpm lint
```

Both must pass clean before marking VES-5 (parent) complete in Linear.
