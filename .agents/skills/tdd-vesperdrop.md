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
