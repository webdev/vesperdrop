# Darkroom MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable-locally Darkroom MVP: marketing site → auth → upload N photos × M presets → durable WDK orchestration of generations against a Docker'd Sceneify → Stripe-billed plan tiers → results.

**Architecture:** Stateless Next.js 16 App Router on top of Supabase (auth + Postgres) and Stripe (subscriptions). Long-running generation orchestration uses Vercel Workflow DevKit (WDK) so step state survives crashes/timeouts. Sceneify is a black-box REST service; Darkroom never imports `@fal-ai/client` or any LLM SDK directly.

**Tech Stack:** Next.js 16 (App Router, Turbopack, src dir), TypeScript strict, Tailwind v4, shadcn/ui, pnpm, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Stripe (`stripe` SDK), Vercel Workflow DevKit (`workflow`), Vercel Blob (`@vercel/blob`), `sharp`, `zod`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-25-darkroom-mvp-design.md`. Read it before starting any phase — it's the source of truth for plan numbers, data model, and architectural constraints. Plan numbers in the spec are placeholders; the design is what's locked.

**Phasing:** Each phase ends in a working/committable state. You can stop or ship at any phase boundary.

| Phase | Outcome |
|-------|---------|
| 0     | Repo initialized as a git repo; spec + plan committed |
| 1     | Next.js + Tailwind + shadcn scaffolded; `pnpm dev` shows a real page; env accessor in place |
| 2     | Supabase local stack runs; schema + RLS migrated; profile trigger works |
| 3     | Auth: sign-in / sign-up / sign-out work end-to-end against local Supabase |
| 4     | Sceneify REST client + WDK runtime wired in; mockable in tests |
| 5     | Marketing site (landing + pricing) ported from `Darkroom.html` to shadcn |
| 6     | `/app` page: upload + preset picker UI works (no generation yet) |
| 7     | Generation flow end-to-end against real Sceneify; results page polls and renders |
| 8     | Watermark composited for free-tier users |
| 9     | Stripe checkout + portal + webhook (idempotent) |
| 10    | Plan gating, rate limit, bounded fan-out |
| 11    | `/account` page: usage, plan management |
| 12    | Playwright smoke test, setup doc, final polish |

---

## Phase 0 — Repo init

**Goal:** Make the directory a git repo and commit the spec + plan.

### Task 0.1: git init + initial commit

**Files:**
- Create: `/Users/gblazer/workspace/darkroom/.gitignore`

- [ ] **Step 1: Initialize git**

```bash
cd /Users/gblazer/workspace/darkroom
git init
git branch -M main
```

- [ ] **Step 2: Create `.gitignore`**

```
# deps
node_modules
.pnpm-store

# next
.next
out
next-env.d.ts

# env
.env
.env.local
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo

# os
.DS_Store

# logs
npm-debug.log*
pnpm-debug.log*

# editor
.vscode
.idea

# test
coverage
playwright-report
test-results

# supabase local
supabase/.branches
supabase/.temp

# darkroom dev artifacts
public/uploads
public/watermarked

# design reference (per project CLAUDE.md, gitignored)
design-reference

# pre-existing assets that aren't part of the app
_current.jpg
screenshots/
uploads/
```

- [ ] **Step 3: Commit spec + plan**

```bash
git add .gitignore CLAUDE.md docs/
git commit -m "chore: init darkroom repo with design spec and implementation plan"
```

---

## Phase 1 — Next.js scaffold + dev tooling foundation

**Goal:** `pnpm dev` runs a real Next 16 app on `:3000` showing a placeholder page. Tailwind + shadcn ready. Typed env accessor in place. Plan-config env vars defined.

### Task 1.1: Scaffold Next.js 16 + TypeScript

**Files:** entire scaffold under `/Users/gblazer/workspace/darkroom/`.

- [ ] **Step 1: Run create-next-app non-interactively**

The current directory has files (`Darkroom.html`, `components/`, etc) so `create-next-app` won't run in-place. Stage existing assets first.

```bash
cd /Users/gblazer/workspace/darkroom
mkdir -p design-reference
git mv Darkroom.html design-canvas.jsx components assets _current.jpg screenshots uploads design-reference/ 2>/dev/null || mv Darkroom.html design-canvas.jsx components assets _current.jpg screenshots uploads design-reference/ 2>/dev/null
```

(The `design-reference/` dir is in `.gitignore` per project CLAUDE.md.)

- [ ] **Step 2: Scaffold Next.js**

```bash
pnpm create next-app@latest . \
  --ts --tailwind --eslint --app --src-dir --turbopack \
  --import-alias "@/*" --use-pnpm --no-git
```

When prompted to overwrite, allow it (the only existing file is `CLAUDE.md` which we want to keep — answer "no" to overwrite if it asks specifically about CLAUDE.md, otherwise yes). Verify `CLAUDE.md` survives; if not, restore from git: `git checkout CLAUDE.md`.

- [ ] **Step 3: Pin Next 16 + verify**

```bash
pnpm install next@16 react@19 react-dom@19
pnpm dev
```

Open http://localhost:3000 — should see the default Next welcome page. Stop the dev server.

- [ ] **Step 4: Commit scaffold**

```bash
git add .
git commit -m "feat: scaffold next.js 16 app with tailwind, typescript, src dir"
```

### Task 1.2: Install shadcn/ui

- [ ] **Step 1: Init shadcn**

```bash
pnpm dlx shadcn@latest init -d
```

(Choose Tailwind v4 / new-york style / neutral base color when prompted; if the CLI runs non-interactively with `-d` it picks defaults.)

- [ ] **Step 2: Add the primitives we'll need across the app**

```bash
pnpm dlx shadcn@latest add button input label card dialog dropdown-menu \
  separator badge skeleton sonner avatar tabs tooltip
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: install shadcn/ui primitives"
```

### Task 1.3: Typed env accessor

**Files:**
- Create: `src/lib/env.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Write `src/lib/env.ts`**

```ts
import "server-only";
import { z } from "zod";

const bool = z
  .union([z.literal("true"), z.literal("false")])
  .transform((v) => v === "true");

const ServerEnv = z.object({
  // Sceneify
  SCENEIFY_API_URL: z.string().url(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_PRO_PRICE_ID: z.string().min(1),

  // Plan config
  PLAN_FREE_MONTHLY_GENERATIONS: z.coerce.number().int().nonnegative(),
  PLAN_FREE_WATERMARK: bool,
  PLAN_PRO_PRICE_USD: z.coerce.number().nonnegative(),
  PLAN_PRO_MONTHLY_GENERATIONS: z.coerce.number().int().nonnegative(),
  PLAN_PRO_WATERMARK: bool,

  // Throughput guards
  MAX_RUN_IMAGES: z.coerce.number().int().positive(),
  RUNS_PER_MINUTE_PER_USER: z.coerce.number().int().positive(),

  // Vercel Blob (optional locally)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

export const env = ServerEnv.parse(process.env);
```

- [ ] **Step 2: Write `.env.local.example`**

```
# Sceneify
SCENEIFY_API_URL=http://localhost:8080

# Supabase (local stack)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-after-supabase-start
SUPABASE_SERVICE_ROLE_KEY=replace-after-supabase-start

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRO_PRICE_ID=price_...

# Plan config (placeholders — pick real numbers later)
PLAN_FREE_MONTHLY_GENERATIONS=10
PLAN_FREE_WATERMARK=true
PLAN_PRO_PRICE_USD=20
PLAN_PRO_MONTHLY_GENERATIONS=0
PLAN_PRO_WATERMARK=false

# Throughput guards
MAX_RUN_IMAGES=60
RUNS_PER_MINUTE_PER_USER=3

# Vercel Blob (leave empty locally; Darkroom falls back to ./public/watermarked)
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/env.ts .env.local.example
git commit -m "feat: typed env accessor with plan config and throughput guards"
```

### Task 1.4: Tailwind theme tokens (port from `Darkroom.html`)

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the default theme block in `src/app/globals.css`**

Look at `design-reference/Darkroom.html` head `<style>` for the canonical palette. Add these CSS variables under `@theme` (Tailwind v4 syntax). Keep shadcn's existing tokens alongside.

```css
@theme {
  --color-paper: #f4f0e8;
  --color-paper-2: #ebe6dc;
  --color-paper-3: #ddd6c6;
  --color-ink: #1b1915;
  --color-ink-2: #3d3830;
  --color-ink-3: #6b6458;
  --color-ink-4: #a59e8f;
  --color-ember: #c2451c;
  --color-ember-soft: #e8a58b;
  --color-cream: #faf7f0;

  --font-serif: "Newsreader", "Times New Roman", serif;
  --font-sans: "Geist", -apple-system, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
}

body {
  font-family: var(--font-sans);
  color: var(--color-ink);
  background: var(--color-paper);
  -webkit-font-smoothing: antialiased;
  background-image:
    radial-gradient(rgba(27, 25, 21, 0.035) 1px, transparent 1px),
    radial-gradient(rgba(27, 25, 21, 0.02) 1px, transparent 1px);
  background-size: 3px 3px, 7px 7px;
  background-position: 0 0, 1px 1px;
}
```

- [ ] **Step 2: Wire fonts in `src/app/layout.tsx`**

Use Next 16 `next/font/google` for Geist + Newsreader + JetBrains_Mono and apply them as CSS variables on `<html>`.

```tsx
import { Geist, Newsreader, JetBrains_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-serif" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

// in RootLayout:
<html lang="en" className={`${geist.variable} ${newsreader.variable} ${mono.variable}`}>
```

- [ ] **Step 3: Sanity-check**

```bash
pnpm dev
```

Visit `http://localhost:3000` — background should be paper-warm (`#f4f0e8`) with subtle grain.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: apply darkroom palette and typography from design reference"
```

### Task 1.5: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install**

```bash
pnpm add -D vitest @vitest/ui @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @types/node
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 3: Write `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add scripts to `package.json`**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint && tsc --noEmit"
  }
}
```

- [ ] **Step 5: Confirm tests run (empty)**

```bash
pnpm test
```

Expected: "No test files found" — that's OK.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json pnpm-lock.yaml
git commit -m "chore: add vitest config and test scripts"
```

---

## Phase 2 — Supabase local + schema

**Goal:** `pnpm db:start` brings up local Supabase. Migrations apply schema from spec. RLS policies in place. Profile trigger creates a row on user signup.

### Task 2.1: Initialize Supabase locally

- [ ] **Step 1: Install Supabase CLI dependency**

```bash
pnpm add -D supabase
```

- [ ] **Step 2: Init**

```bash
pnpm supabase init
```

Accept defaults. This creates `supabase/config.toml` and `supabase/migrations/`.

- [ ] **Step 3: Add scripts to `package.json`**

```json
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:status": "supabase status",
"db:migrate": "supabase migration up",
"db:reset": "supabase db reset",
"db:diff": "supabase db diff"
```

- [ ] **Step 4: First start**

```bash
pnpm db:start
```

Wait until it prints the local URLs. Copy `anon key`, `service_role key`, `API URL` into `.env.local` (create from `.env.local.example` first if missing).

- [ ] **Step 5: Commit**

```bash
git add supabase/ package.json pnpm-lock.yaml
git commit -m "chore: init local supabase stack"
```

### Task 2.2: Migration — schema from spec

**Files:**
- Create: `supabase/migrations/20260425000001_init_schema.sql`

- [ ] **Step 1: Write migration**

```sql
-- profiles: 1:1 with auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text unique,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  plan_renews_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_count int not null,
  preset_count int not null,
  total_images int not null,
  created_at timestamptz not null default now()
);
create index runs_user_created_idx on public.runs (user_id, created_at desc);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sceneify_source_id text not null,
  sceneify_generation_id text,
  preset_id text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  output_url text,
  watermarked boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index generations_run_idx on public.generations (run_id);
create index generations_user_created_idx on public.generations (user_id, created_at desc);
create index generations_status_idx on public.generations (status);

create table public.usage_monthly (
  user_id uuid not null references public.profiles(id) on delete cascade,
  year_month text not null,
  generation_count int not null default 0,
  primary key (user_id, year_month)
);

create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

create table public.rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  bucket text not null,
  tokens int not null,
  refilled_at timestamptz not null,
  primary key (user_id, bucket)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.generations enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.rate_limits enable row level security;
-- stripe_events is service-role only; no policies, RLS off.

create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "runs_self" on public.runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "generations_self" on public.generations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "usage_self_read" on public.usage_monthly
  for select using (auth.uid() = user_id);

create policy "rate_limits_self_read" on public.rate_limits
  for select using (auth.uid() = user_id);

-- Trigger: create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Apply migration**

```bash
pnpm db:reset
```

(`db:reset` re-runs all migrations from scratch. Use this during development; switch to `db:migrate` later when seeded data matters.)

- [ ] **Step 3: Verify tables exist**

```bash
pnpm supabase db diff --schema public
```

Expected output: empty diff (schema in DB matches migration).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): initial schema with rls and profile trigger"
```

---

## Phase 3 — Auth

**Goal:** Sign-up, sign-in, sign-out work end-to-end against the local Supabase. Authenticated routes are gated by middleware.

### Task 3.1: Supabase client helpers

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/lib/supabase/admin.ts`

- [ ] **Step 1: Install**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Browser client (`src/lib/supabase/client.ts`)**

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Server (RSC/route) client (`src/lib/supabase/server.ts`)**

```ts
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (entries) => {
          for (const { name, value, options } of entries) {
            store.set(name, value, options);
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Middleware refresher (`src/lib/supabase/middleware.ts`)**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (entries) => {
          for (const { name, value, options } of entries) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { response, user };
}
```

- [ ] **Step 5: Service-role admin client (`src/lib/supabase/admin.ts`)**

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/ pnpm-lock.yaml package.json
git commit -m "feat(auth): supabase client/server/admin helpers"
```

### Task 3.2: Middleware — refresh session + gate `/app`, `/account`

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write middleware**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/middleware";

const PROTECTED = ["/app", "/account"];

export async function middleware(request: NextRequest) {
  const { response, user } = await refreshSession(request);
  const path = request.nextUrl.pathname;
  if (PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp)).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): middleware refreshes session and gates app routes"
```

### Task 3.3: Sign-up / sign-in / sign-out routes + UI

**Files:**
- Create: `src/app/(auth)/sign-in/page.tsx`
- Create: `src/app/(auth)/sign-up/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/api/auth/sign-out/route.ts`
- Create: `src/components/app/auth-form.tsx`

- [ ] **Step 1: Auth layout (`src/app/(auth)/layout.tsx`)**

Center a card. Use shadcn `Card`. Plain.

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-16">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
```

- [ ] **Step 2: Shared `AuthForm` client component (`src/components/app/auth-form.tsx`)**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: Mode }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const fn = mode === "sign-in" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error } = await fn({ email, password });
      if (error) { setError(error.message); return; }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-[var(--color-ember)]">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "..." : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Pages**

`src/app/(auth)/sign-in/page.tsx`:

```tsx
import Link from "next/link";
import { AuthForm } from "@/components/app/auth-form";

export default function Page() {
  return (
    <>
      <h1 className="font-serif text-3xl mb-6">Sign in</h1>
      <AuthForm mode="sign-in" />
      <p className="text-sm text-[var(--color-ink-3)] mt-4">
        No account? <Link href="/sign-up" className="underline">Create one</Link>
      </p>
    </>
  );
}
```

`src/app/(auth)/sign-up/page.tsx`: same shape, swap the mode and link.

- [ ] **Step 4: Sign-out route**

`src/app/api/auth/sign-out/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}
```

- [ ] **Step 5: Manual smoke test**

```bash
pnpm dev
```

Visit `/sign-up`, create `dev@example.com` / `password123`. Should redirect to `/app` (which doesn't exist yet — expect 404). Confirm in Supabase Studio (`http://127.0.0.1:54323`) that a row appears in `auth.users` AND `public.profiles`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(auth\) src/app/api/auth src/components/app/auth-form.tsx
git commit -m "feat(auth): sign-in / sign-up / sign-out routes and shared form"
```

---

## Phase 4 — Sceneify client + WDK runtime

**Goal:** Typed REST client for Sceneify with retry on 5xx; WDK installed and a hello-world workflow runs end-to-end.

### Task 4.1: Sceneify TypeScript client

**Files:**
- Create: `src/lib/sceneify/types.ts`
- Create: `src/lib/sceneify/client.ts`
- Create: `src/lib/sceneify/__tests__/client.test.ts`

- [ ] **Step 1: Types**

`src/lib/sceneify/types.ts`:

```ts
export type SceneifySource = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  createdAt: string;
};

export type SceneifyPreset = {
  id: string;
  name: string;
  description?: string;
  referenceImageUrls: string[];
};

export type SceneifyGenerationStatus = "pending" | "running" | "succeeded" | "failed";

export type SceneifyGeneration = {
  id: string;
  sourceId: string;
  presetId: string;
  model: string;
  status: SceneifyGenerationStatus;
  constructedPrompt?: string;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
};

export type SceneifyModelId = "gpt-image-2" | "nano-banana-2";
```

- [ ] **Step 2: Failing test first (`src/lib/sceneify/__tests__/client.test.ts`)**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SceneifyClient, SceneifyError } from "../client";

const baseUrl = "http://sceneify.test";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("SceneifyClient", () => {
  it("listPresets returns presets array", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ presets: [{ id: "studio-direct", name: "Studio", referenceImageUrls: [] }] }), { status: 200 }),
    );
    const client = new SceneifyClient(baseUrl);
    const presets = await client.listPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBe("studio-direct");
  });

  it("retries on 5xx and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("oops", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ presets: [] }), { status: 200 }));
    const client = new SceneifyClient(baseUrl, { retryDelayMs: 1 });
    await client.listPresets();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 4xx", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 400 }));
    const client = new SceneifyClient(baseUrl, { retryDelayMs: 1 });
    await expect(client.listPresets()).rejects.toBeInstanceOf(SceneifyError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run — should fail (module missing)**

```bash
pnpm test
```

Expected: FAIL ("cannot find module '../client'").

- [ ] **Step 4: Implement `src/lib/sceneify/client.ts`**

```ts
import "server-only";
import type { SceneifyGeneration, SceneifyModelId, SceneifyPreset, SceneifySource } from "./types";

export class SceneifyError extends Error {
  constructor(message: string, public status?: number, public body?: string) {
    super(message);
    this.name = "SceneifyError";
  }
}

type Options = { retries?: number; retryDelayMs?: number; timeoutMs?: number };

export class SceneifyClient {
  constructor(private baseUrl: string, private opts: Options = {}) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const retries = this.opts.retries ?? 3;
    const retryDelayMs = this.opts.retryDelayMs ?? 500;
    const timeoutMs = this.opts.timeoutMs ?? 300_000;
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}${path}`, { ...init, signal: ctrl.signal });
        clearTimeout(t);
        if (res.status >= 500) {
          lastError = new SceneifyError(`Sceneify ${res.status}`, res.status, await res.text().catch(() => undefined));
        } else if (!res.ok) {
          throw new SceneifyError(`Sceneify ${res.status}`, res.status, await res.text().catch(() => undefined));
        } else {
          return (await res.json()) as T;
        }
      } catch (e) {
        clearTimeout(t);
        if (e instanceof SceneifyError && e.status && e.status < 500) throw e;
        lastError = e;
      }
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, retryDelayMs * Math.pow(2, attempt)));
      }
    }
    throw lastError instanceof Error ? lastError : new SceneifyError("Unknown sceneify error");
  }

  async listPresets(): Promise<SceneifyPreset[]> {
    const { presets } = await this.request<{ presets: SceneifyPreset[] }>("/api/presets");
    return presets;
  }

  async uploadSource(file: File | Blob, filename: string): Promise<SceneifySource> {
    const form = new FormData();
    form.append("file", file, filename);
    const { source } = await this.request<{ source: SceneifySource }>("/api/sources", { method: "POST", body: form });
    return source;
  }

  async createGeneration(params: { sourceId: string; presetId: string; model: SceneifyModelId }): Promise<SceneifyGeneration> {
    const { generation } = await this.request<{ generation: SceneifyGeneration }>("/api/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    return generation;
  }

  async getGeneration(id: string): Promise<SceneifyGeneration> {
    const { generation } = await this.request<{ generation: SceneifyGeneration }>(`/api/generations/${id}`);
    return generation;
  }
}

import { env } from "@/lib/env";
let _client: SceneifyClient | null = null;
export function sceneify() {
  if (!_client) _client = new SceneifyClient(env.SCENEIFY_API_URL);
  return _client;
}
```

- [ ] **Step 5: Tests pass**

```bash
pnpm test
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sceneify/
git commit -m "feat(sceneify): typed rest client with retry on 5xx"
```

### Task 4.2: WDK runtime

**Files:**
- Create: `src/app/api/workflows/[...slug]/route.ts`
- Create: `src/lib/workflows/index.ts` (registry)
- Create: `src/lib/workflows/hello.ts` (smoke workflow)

- [ ] **Step 1: Install WDK**

```bash
pnpm add workflow
```

- [ ] **Step 2: Hello workflow (`src/lib/workflows/hello.ts`)**

```ts
import "server-only";
import { defineWorkflow, step } from "workflow";

export const hello = defineWorkflow({
  name: "hello",
  input: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } as const,
  async run({ name }: { name: string }) {
    const greeting = await step("greet", async () => `hello, ${name}`);
    return { greeting };
  },
});
```

> Note: WDK API surface may differ slightly; consult the `vercel:workflow` skill for the exact import shape during execution. The intent is: a named workflow with a typed input schema and one step. Adjust the call signature to match the installed version of `workflow` if needed.

- [ ] **Step 3: Registry (`src/lib/workflows/index.ts`)**

```ts
import "server-only";
import { hello } from "./hello";
export const workflows = [hello];
```

- [ ] **Step 4: Route handler (`src/app/api/workflows/[...slug]/route.ts`)**

```ts
import { handleWorkflowRequest } from "workflow/next";
import { workflows } from "@/lib/workflows";

const handler = handleWorkflowRequest({ workflows });

export const GET = handler;
export const POST = handler;
export const runtime = "nodejs";
export const maxDuration = 300;
```

- [ ] **Step 5: Smoke test by triggering the workflow**

Add a tiny dev-only route `src/app/api/dev/hello/route.ts`:

```ts
import { NextResponse } from "next/server";
import { hello } from "@/lib/workflows/hello";
import { trigger } from "workflow";

export async function GET() {
  const { id } = await trigger(hello, { name: "darkroom" });
  return NextResponse.json({ id });
}
```

```bash
pnpm dev
curl http://localhost:3000/api/dev/hello
```

Expected: JSON with workflow id.

- [ ] **Step 6: Delete the dev route once verified**

```bash
rm -rf src/app/api/dev
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/workflows/ src/app/api/workflows/ package.json pnpm-lock.yaml
git commit -m "feat(workflows): wdk runtime + hello workflow"
```

---

## Phase 5 — Marketing site

**Goal:** `/` and `/pricing` rendered with Darkroom aesthetic, ported from `design-reference/Darkroom.html`.

### Task 5.1: Landing page

**Files:**
- Create: `src/app/(marketing)/layout.tsx`
- Create: `src/app/(marketing)/page.tsx`
- Create: `src/components/marketing/hero.tsx`
- Create: `src/components/marketing/how-it-works.tsx`
- Create: `src/components/marketing/footer.tsx`
- Create: `src/components/marketing/site-nav.tsx`

- [ ] **Step 1: Layout (`src/app/(marketing)/layout.tsx`)**

Wrap children in `SiteNav` + `Footer`. Plain.

```tsx
import { SiteNav } from "@/components/marketing/site-nav";
import { Footer } from "@/components/marketing/footer";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Build `SiteNav`, `Hero`, `HowItWorks`, `Footer`**

Open `design-reference/Darkroom.html` and `design-reference/design-canvas.jsx`. Port the hero, how-it-works, and nav sections — refactor to Tailwind classes that reference the theme tokens defined in `globals.css` (`text-[var(--color-ink)]`, `font-serif`, etc). CTAs link to `/sign-up` and `/pricing`. Don't pixel-copy; aim for fidelity to the spirit per CLAUDE.md ("directional, not pixel-sacred").

Each component is a server component (no client-side state needed for the marketing pages). Keep each file under ~150 lines; if a section grows, split it.

- [ ] **Step 3: Wire on the landing page (`src/app/(marketing)/page.tsx`)**

```tsx
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";

export default function Page() {
  return (
    <>
      <Hero />
      <HowItWorks />
    </>
  );
}
```

- [ ] **Step 4: Move root `page.tsx`**

Delete the default `src/app/page.tsx` — the route group `(marketing)` provides `/`.

- [ ] **Step 5: Visual check**

```bash
pnpm dev
```

Visit `/`. Confirm fonts load, palette matches, CTAs route to `/sign-up`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(marketing\) src/components/marketing/
git rm -f src/app/page.tsx 2>/dev/null || true
git commit -m "feat(marketing): landing page with darkroom aesthetic"
```

### Task 5.2: Pricing page

**Files:**
- Create: `src/app/(marketing)/pricing/page.tsx`
- Create: `src/components/marketing/pricing-cards.tsx`

- [ ] **Step 1: Plan-aware pricing cards**

Read plan numbers from `env`. Two cards: Free and Pro. Pro CTA links to `/api/stripe/checkout` (which we'll build in Phase 9 — for now just `<a href="/api/stripe/checkout">Upgrade</a>`).

```tsx
import { env } from "@/lib/env";

export function PricingCards() {
  return (
    <section className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto px-6 py-16">
      <div className="border border-[var(--color-line)] rounded-lg p-8 bg-[var(--color-cream)]">
        <h3 className="font-serif text-2xl mb-2">Free</h3>
        <p className="text-[var(--color-ink-3)] mb-6">Try it out.</p>
        <p className="text-3xl font-serif mb-6">$0</p>
        <ul className="space-y-2 text-sm">
          <li>{env.PLAN_FREE_MONTHLY_GENERATIONS} images / month</li>
          <li>Watermarked previews</li>
        </ul>
      </div>
      <div className="border border-[var(--color-ink)] rounded-lg p-8 bg-[var(--color-ink)] text-[var(--color-cream)]">
        <h3 className="font-serif text-2xl mb-2">Pro</h3>
        <p className="opacity-70 mb-6">For sellers shipping catalog.</p>
        <p className="text-3xl font-serif mb-6">${env.PLAN_PRO_PRICE_USD}/mo</p>
        <ul className="space-y-2 text-sm">
          <li>{env.PLAN_PRO_MONTHLY_GENERATIONS === 0 ? "Unlimited" : env.PLAN_PRO_MONTHLY_GENERATIONS} images / month</li>
          <li>No watermark, full resolution</li>
        </ul>
        <a href="/api/stripe/checkout" className="block text-center mt-6 bg-[var(--color-ember)] text-white py-3 rounded">Upgrade</a>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Page**

```tsx
import { PricingCards } from "@/components/marketing/pricing-cards";

export default function Page() {
  return <PricingCards />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(marketing\)/pricing src/components/marketing/pricing-cards.tsx
git commit -m "feat(marketing): pricing page driven by plan config"
```

---

## Phase 6 — `/app` page: upload + preset picker UI (no generation)

**Goal:** A logged-in user lands on `/app`, can drop N image files, and pick M presets fetched from Sceneify. The "Generate" button is wired but currently 404s — we'll connect it in Phase 7.

### Task 6.1: App layout + signed-in shell

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/app/app-nav.tsx`

- [ ] **Step 1: App layout**

Server component — fetch user from Supabase, hand to `AppNav`.

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app/app-nav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <>
      <AppNav email={user?.email ?? ""} />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </>
  );
}
```

- [ ] **Step 2: Build `AppNav`**

Logo/wordmark linking to `/app`, link to `/account`, sign-out form posting to `/api/auth/sign-out`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\) src/components/app/app-nav.tsx
git commit -m "feat(app): authenticated layout with nav"
```

### Task 6.2: `/app` page — upload + preset picker

**Files:**
- Create: `src/app/(app)/app/page.tsx`
- Create: `src/app/(app)/app/error.tsx`
- Create: `src/components/app/upload-dropzone.tsx`
- Create: `src/components/app/preset-picker.tsx`
- Create: `src/components/app/run-form.tsx`

- [ ] **Step 1: Server-side preset fetch in the page**

```tsx
import { sceneify } from "@/lib/sceneify/client";
import { RunForm } from "@/components/app/run-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const presets = await sceneify().listPresets();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-4xl">New batch</h1>
        <p className="text-[var(--color-ink-3)] mt-2">Upload product photos, pick presets, generate.</p>
      </header>
      <RunForm presets={presets} />
    </div>
  );
}
```

- [ ] **Step 2: Error boundary (`error.tsx`)**

```tsx
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4 py-12">
      <h2 className="font-serif text-2xl">Something went wrong</h2>
      <p className="text-sm text-[var(--color-ink-3)]">{error.message}</p>
      <button onClick={reset} className="underline">Try again</button>
    </div>
  );
}
```

- [ ] **Step 3: `UploadDropzone` client component**

Drag-and-drop + file input. Stores `File[]` in parent via `onChange`. Keep it small — no virtualization, no preview cropping.

- [ ] **Step 4: `PresetPicker` client component**

Multi-select grid of preset cards (image thumbnail = first `referenceImageUrls`, name, description). Toggle by click. Stores `string[]` in parent via `onChange`.

- [ ] **Step 5: `RunForm` parent client component**

Holds `files: File[]`, `presetIds: string[]`. Submit button disabled until both lists are non-empty. On submit, POSTs to `/api/runs` (404 for now) and redirects to `/app/runs/:id`.

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SceneifyPreset } from "@/lib/sceneify/types";
import { UploadDropzone } from "./upload-dropzone";
import { PresetPicker } from "./preset-picker";
import { Button } from "@/components/ui/button";

export function RunForm({ presets }: { presets: SceneifyPreset[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [presetIds, setPresetIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    start(async () => {
      const form = new FormData();
      for (const f of files) form.append("files", f, f.name);
      for (const id of presetIds) form.append("presetIds", id);
      const res = await fetch("/api/runs", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const { runId } = await res.json();
      router.push(`/app/runs/${runId}`);
    });
  }

  const total = files.length * presetIds.length;
  return (
    <div className="space-y-8">
      <UploadDropzone onChange={setFiles} files={files} />
      <PresetPicker presets={presets} value={presetIds} onChange={setPresetIds} />
      {error && <p className="text-sm text-[var(--color-ember)]">{error}</p>}
      <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-6">
        <p className="text-sm text-[var(--color-ink-3)]">
          {files.length} photo{files.length === 1 ? "" : "s"} × {presetIds.length} preset{presetIds.length === 1 ? "" : "s"} = <strong>{total}</strong> images
        </p>
        <Button disabled={!files.length || !presetIds.length || pending} onClick={submit}>
          {pending ? "Starting..." : "Generate"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Manual smoke test**

Sign in, visit `/app`. Confirm presets load (Sceneify must be running locally). Drop a file, pick a preset, click Generate — expect a 404 (route doesn't exist yet).

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/app src/components/app/upload-dropzone.tsx src/components/app/preset-picker.tsx src/components/app/run-form.tsx
git commit -m "feat(app): upload + preset picker UI on /app"
```

---

## Phase 7 — Generation flow (orchestration end-to-end)

**Goal:** `POST /api/runs` creates rows, triggers the `processRun` workflow, returns `{ runId }`. Workflow uploads sources and fans out generations against Sceneify in parallel. `/app/runs/:id` page polls and renders results.

### Task 7.1: Zod schemas for `/api/runs`

**Files:**
- Create: `src/lib/schema/runs.ts`

- [ ] **Step 1: Schema**

```ts
import { z } from "zod";

export const RunCreateSchema = z.object({
  presetIds: z.array(z.string().min(1)).min(1).max(20),
  // files validated separately because they come from FormData
});

export type RunCreate = z.infer<typeof RunCreateSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/schema/
git commit -m "feat(schema): runs create schema"
```

### Task 7.2: DB query helpers

**Files:**
- Create: `src/lib/db/runs.ts`
- Create: `src/lib/db/generations.ts`

- [ ] **Step 1: `src/lib/db/runs.ts`**

```ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function createRun(params: {
  userId: string;
  sourceCount: number;
  presetCount: number;
}) {
  const totalImages = params.sourceCount * params.presetCount;
  const { data, error } = await supabaseAdmin
    .from("runs")
    .insert({
      user_id: params.userId,
      source_count: params.sourceCount,
      preset_count: params.presetCount,
      total_images: totalImages,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, totalImages };
}

export async function getRunForUser(runId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: `src/lib/db/generations.ts`**

```ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function insertPendingGenerations(rows: Array<{
  runId: string;
  userId: string;
  sceneifySourceId: string;     // empty string until upload step writes it; we use a placeholder pattern below
  presetId: string;
}>) {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .insert(rows.map((r) => ({
      run_id: r.runId,
      user_id: r.userId,
      sceneify_source_id: r.sceneifySourceId,
      preset_id: r.presetId,
    })))
    .select("id, preset_id, sceneify_source_id");
  if (error) throw error;
  return data;
}

export async function updateGeneration(id: string, patch: {
  status?: "running" | "succeeded" | "failed";
  sceneifyGenerationId?: string;
  sceneifySourceId?: string;
  outputUrl?: string;
  watermarked?: boolean;
  error?: string;
  completedAt?: string;
}) {
  const { error } = await supabaseAdmin.from("generations").update({
    ...(patch.status && { status: patch.status }),
    ...(patch.sceneifyGenerationId && { sceneify_generation_id: patch.sceneifyGenerationId }),
    ...(patch.sceneifySourceId && { sceneify_source_id: patch.sceneifySourceId }),
    ...(patch.outputUrl && { output_url: patch.outputUrl }),
    ...(patch.watermarked !== undefined && { watermarked: patch.watermarked }),
    ...(patch.error && { error: patch.error }),
    ...(patch.completedAt && { completed_at: patch.completedAt }),
  }).eq("id", id);
  if (error) throw error;
}

export async function listGenerationsForRun(runId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("*")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}
```

> Why service-role for these: the workflow runs outside an authenticated request context. Authorization is enforced on the API surface (`/api/runs/:id`) by checking `auth.uid() === row.user_id` in the route handler before returning data.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/
git commit -m "feat(db): typed helpers for runs and generations"
```

### Task 7.3: `processRun` workflow

**Files:**
- Create: `src/lib/workflows/process-run.ts`
- Modify: `src/lib/workflows/index.ts`
- Delete: `src/lib/workflows/hello.ts`

- [ ] **Step 1: Workflow**

```ts
import "server-only";
import { defineWorkflow, step } from "workflow";
import { sceneify } from "@/lib/sceneify/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateGeneration } from "@/lib/db/generations";

type Input = {
  runId: string;
  userId: string;
  sourceUploads: Array<{ blobUrl: string; filename: string; mimeType: string; placeholderKey: string }>;
  presetIds: string[];
};

export const processRun = defineWorkflow({
  name: "process-run",
  async run(input: Input) {
    const sourceMap = await step("upload-sources", async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        input.sourceUploads.map(async (u) => {
          const res = await fetch(u.blobUrl);
          const blob = await res.blob();
          const source = await sceneify().uploadSource(blob, u.filename);
          map[u.placeholderKey] = source.id;
        }),
      );
      // Backfill sceneify_source_id on the rows that were inserted with the placeholder
      for (const [placeholder, realId] of Object.entries(map)) {
        await supabaseAdmin
          .from("generations")
          .update({ sceneify_source_id: realId })
          .eq("run_id", input.runId)
          .eq("sceneify_source_id", placeholder);
      }
      return map;
    });

    // Pull pending generations and dispatch in parallel
    const { data: pending } = await supabaseAdmin
      .from("generations")
      .select("id, sceneify_source_id, preset_id")
      .eq("run_id", input.runId)
      .eq("status", "pending");

    await Promise.all(
      (pending ?? []).map((row) =>
        step(`generate-${row.id}`, async () => {
          await updateGeneration(row.id, { status: "running" });
          try {
            const gen = await sceneify().createGeneration({
              sourceId: row.sceneify_source_id,
              presetId: row.preset_id,
              model: "gpt-image-2",
            });
            await updateGeneration(row.id, {
              status: gen.status,
              sceneifyGenerationId: gen.id,
              outputUrl: gen.outputUrl,
              error: gen.error,
              completedAt: gen.completedAt ?? new Date().toISOString(),
            });
          } catch (e) {
            await updateGeneration(row.id, {
              status: "failed",
              error: e instanceof Error ? e.message : String(e),
              completedAt: new Date().toISOString(),
            });
          }
        }),
      ),
    );

    // Increment usage by succeeded count
    await step("finalize", async () => {
      const { data: succeeded } = await supabaseAdmin
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("run_id", input.runId)
        .eq("status", "succeeded");
      const ym = new Date().toISOString().slice(0, 7);
      const succeededCount = succeeded?.length ?? 0;
      if (succeededCount > 0) {
        await supabaseAdmin.rpc("increment_usage", {
          p_user_id: input.userId,
          p_year_month: ym,
          p_delta: succeededCount,
        });
      }
    });
  },
});
```

- [ ] **Step 2: Add the `increment_usage` RPC migration**

`supabase/migrations/20260425000002_usage_rpc.sql`:

```sql
create or replace function public.increment_usage(p_user_id uuid, p_year_month text, p_delta int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.usage_monthly (user_id, year_month, generation_count)
  values (p_user_id, p_year_month, p_delta)
  on conflict (user_id, year_month)
  do update set generation_count = public.usage_monthly.generation_count + excluded.generation_count;
end;
$$;
```

```bash
pnpm db:reset
```

- [ ] **Step 3: Update workflow registry; remove hello**

`src/lib/workflows/index.ts`:

```ts
import "server-only";
import { processRun } from "./process-run";
export const workflows = [processRun];
```

```bash
rm src/lib/workflows/hello.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/workflows/ supabase/migrations/
git commit -m "feat(workflows): process-run orchestration with usage increment"
```

### Task 7.4: `POST /api/runs` route

**Files:**
- Create: `src/app/api/runs/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { trigger } from "workflow";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createRun } from "@/lib/db/runs";
import { insertPendingGenerations } from "@/lib/db/generations";
import { processRun } from "@/lib/workflows/process-run";
import { env } from "@/lib/env";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const presetIds = form.getAll("presetIds").map(String);

  const parsed = z.object({
    presetIds: z.array(z.string().min(1)).min(1).max(20),
    files: z.array(z.any()).min(1).max(20),
  }).safeParse({ presetIds, files });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const total = files.length * presetIds.length;
  if (total > env.MAX_RUN_IMAGES) {
    return NextResponse.json({ error: `Run exceeds ${env.MAX_RUN_IMAGES} images.` }, { status: 400 });
  }

  // Stash files: Vercel Blob if available, else local fs
  const sourceUploads = await Promise.all(files.map(async (file, i) => {
    const placeholderKey = `pending-${user.id}-${Date.now()}-${i}`;
    let blobUrl: string;
    if (env.BLOB_READ_WRITE_TOKEN) {
      const result = await put(`runs/${placeholderKey}`, file, { access: "public" });
      blobUrl = result.url;
    } else {
      const dir = path.join(process.cwd(), "public", "uploads");
      const buf = Buffer.from(await file.arrayBuffer());
      const filename = `${placeholderKey}-${file.name}`;
      await writeFile(path.join(dir, filename), buf);
      blobUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/uploads/${filename}`;
    }
    return { blobUrl, filename: file.name, mimeType: file.type, placeholderKey };
  }));

  const { id: runId } = await createRun({
    userId: user.id,
    sourceCount: files.length,
    presetCount: presetIds.length,
  });

  const rows: Array<{ runId: string; userId: string; sceneifySourceId: string; presetId: string }> = [];
  for (const upload of sourceUploads) {
    for (const presetId of presetIds) {
      rows.push({ runId, userId: user.id, sceneifySourceId: upload.placeholderKey, presetId });
    }
  }
  await insertPendingGenerations(rows);

  await trigger(processRun, { runId, userId: user.id, sourceUploads, presetIds });

  return NextResponse.json({ runId });
}
```

- [ ] **Step 2: Ensure `public/uploads/` exists**

```bash
mkdir -p public/uploads public/watermarked
echo "*\n!.gitkeep" > public/uploads/.gitignore
echo "*\n!.gitkeep" > public/watermarked/.gitignore
touch public/uploads/.gitkeep public/watermarked/.gitkeep
```

- [ ] **Step 3: Install Blob SDK**

```bash
pnpm add @vercel/blob
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/runs/route.ts public/uploads/ public/watermarked/ package.json pnpm-lock.yaml
git commit -m "feat(api): POST /api/runs creates run rows and triggers workflow"
```

### Task 7.5: `GET /api/runs/:id` + run page polling

**Files:**
- Create: `src/app/api/runs/[id]/route.ts`
- Create: `src/app/(app)/app/runs/[id]/page.tsx`
- Create: `src/app/(app)/app/runs/[id]/run-grid.tsx`
- Create: `src/app/(app)/app/runs/[id]/error.tsx`

- [ ] **Step 1: GET route**

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listGenerationsForRun, getRunForUser } from "@/lib/db/runs";
import { listGenerationsForRun as listGen } from "@/lib/db/generations";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const run = await getRunForUser(id, user.id);
  const generations = await listGen(id, user.id);
  return NextResponse.json({ run, generations });
}
```

(Drop the `listGenerationsForRun` import from `@/lib/db/runs` — it's only in `generations`. Adjust imports accordingly.)

- [ ] **Step 2: Page (server) + grid (client poller)**

`page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRunForUser } from "@/lib/db/runs";
import { listGenerationsForRun } from "@/lib/db/generations";
import { redirect, notFound } from "next/navigation";
import { RunGrid } from "./run-grid";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/app/runs/" + id);
  const run = await getRunForUser(id, user.id).catch(() => null);
  if (!run) notFound();
  const initial = await listGenerationsForRun(id, user.id);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Run</h1>
        <p className="text-sm text-[var(--color-ink-3)]">{run.total_images} images</p>
      </header>
      <RunGrid runId={id} initial={initial} />
    </div>
  );
}
```

`run-grid.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";

type Generation = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  output_url: string | null;
  preset_id: string;
  error: string | null;
};

export function RunGrid({ runId, initial }: { runId: string; initial: Generation[] }) {
  const [gens, setGens] = useState<Generation[]>(initial);
  useEffect(() => {
    const allDone = gens.every((g) => g.status === "succeeded" || g.status === "failed");
    if (allDone) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) return;
      const { generations } = await res.json();
      setGens(generations);
    }, 2500);
    return () => clearInterval(t);
  }, [runId, gens]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {gens.map((g) => (
        <div key={g.id} className="aspect-square border border-[var(--color-line)] bg-[var(--color-paper-2)] grid place-items-center overflow-hidden">
          {g.status === "succeeded" && g.output_url ? (
            <img src={g.output_url} alt="" className="w-full h-full object-cover" />
          ) : g.status === "failed" ? (
            <span className="text-xs text-[var(--color-ember)] p-4">{g.error ?? "failed"}</span>
          ) : (
            <span className="text-xs text-[var(--color-ink-3)] animate-pulse">{g.status}</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Whitelist Sceneify image domain**

`next.config.ts`:

```ts
import type { NextConfig } from "next";
const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8080" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};
export default config;
```

(We're using plain `<img>` not `next/image` in the grid, so this is for future use — but set it now.)

- [ ] **Step 4: End-to-end smoke test**

Sceneify must be running on `:8080` with at least one preset and a working `FAL_KEY`. Sign in, upload one photo, pick one preset, click Generate. Watch the grid go pending → running → succeeded.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/runs/\[id\] src/app/\(app\)/app/runs next.config.ts
git commit -m "feat(app): run results page with polling against sceneify"
```

---

## Phase 8 — Watermark

**Goal:** When the user's plan flag says watermark, the workflow downloads the Sceneify output, composites a diagonal-stripe watermark, hosts the watermarked version, and replaces `output_url`.

### Task 8.1: Watermark pipeline

**Files:**
- Create: `src/lib/watermark.ts`
- Create: `src/lib/watermark.test.ts`

- [ ] **Step 1: Install sharp**

```bash
pnpm add sharp
```

- [ ] **Step 2: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { applyWatermark } from "./watermark";
import { readFileSync } from "node:fs";
import sharp from "sharp";

describe("applyWatermark", () => {
  it("returns a buffer with the same dimensions as the input", async () => {
    const input = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#888" },
    }).png().toBuffer();
    const out = await applyWatermark(input, "DARKROOM PREVIEW");
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });
});
```

- [ ] **Step 3: Implement**

```ts
import "server-only";
import sharp from "sharp";

export async function applyWatermark(input: Buffer, label: string): Promise<Buffer> {
  const { width = 1024, height = 1024 } = await sharp(input).metadata();
  const fontSize = Math.round(Math.min(width, height) / 18);
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <pattern id="wm" patternUnits="userSpaceOnUse" width="${width}" height="${fontSize * 4}" patternTransform="rotate(-30)">
           <text x="0" y="${fontSize * 1.5}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="rgba(255,255,255,0.35)" stroke="rgba(0,0,0,0.25)" stroke-width="1">${label}</text>
         </pattern>
       </defs>
       <rect width="100%" height="100%" fill="url(#wm)"/>
     </svg>`,
  );
  return sharp(input).composite([{ input: svg, blend: "over" }]).toBuffer();
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/watermark.ts src/lib/watermark.test.ts package.json pnpm-lock.yaml
git commit -m "feat(watermark): sharp-based diagonal stripe watermark"
```

### Task 8.2: Storage helper for watermarked output

**Files:**
- Create: `src/lib/storage.ts`

- [ ] **Step 1: Implement**

```ts
import "server-only";
import { put } from "@vercel/blob";
import { env } from "@/lib/env";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function storeWatermarked(buffer: Buffer, key: string, contentType = "image/png"): Promise<string> {
  if (env.BLOB_READ_WRITE_TOKEN) {
    const result = await put(`watermarked/${key}`, buffer, { access: "public", contentType });
    return result.url;
  }
  const dir = path.join(process.cwd(), "public", "watermarked");
  await writeFile(path.join(dir, key), buffer);
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/watermarked/${key}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat(storage): watermarked image storage abstraction"
```

### Task 8.3: Wire watermark into `processRun`

**Files:**
- Modify: `src/lib/workflows/process-run.ts`

- [ ] **Step 1: After the parallel generate steps, before `finalize`, add a parallel watermark fan-out**

Read the user's plan from `profiles`. If the appropriate plan watermark flag is true, post-process every `succeeded` row:

```ts
// inside processRun, after the generate Promise.all and before the finalize step:
const { data: profile } = await supabaseAdmin
  .from("profiles")
  .select("plan")
  .eq("id", input.userId)
  .single();

const shouldWatermark =
  (profile?.plan === "free" && env.PLAN_FREE_WATERMARK) ||
  (profile?.plan === "pro" && env.PLAN_PRO_WATERMARK);

if (shouldWatermark) {
  const { data: succeededRows } = await supabaseAdmin
    .from("generations")
    .select("id, output_url")
    .eq("run_id", input.runId)
    .eq("status", "succeeded")
    .eq("watermarked", false);

  await Promise.all(
    (succeededRows ?? []).map((row) =>
      step(`watermark-${row.id}`, async () => {
        if (!row.output_url) return;
        const res = await fetch(row.output_url);
        const buf = Buffer.from(await res.arrayBuffer());
        const out = await applyWatermark(buf, "DARKROOM PREVIEW");
        const url = await storeWatermarked(out, `${row.id}.png`);
        await updateGeneration(row.id, { outputUrl: url, watermarked: true });
      }),
    ),
  );
}
```

Add imports for `applyWatermark`, `storeWatermarked`, `env` at top of file.

- [ ] **Step 2: Smoke test**

Sign up a new free-tier account, run a generation, confirm the rendered image has the watermark.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workflows/process-run.ts
git commit -m "feat(workflows): apply watermark for free-tier runs"
```

---

## Phase 9 — Stripe billing

**Goal:** Pro upgrade goes through Stripe Checkout; subscription state syncs via webhook (idempotent on event id); customer portal manages cancellation.

### Task 9.1: Stripe SDK + helpers

**Files:**
- Create: `src/lib/stripe/server.ts`

- [ ] **Step 1: Install**

```bash
pnpm add stripe
```

- [ ] **Step 2: Server helper**

```ts
import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/stripe/ package.json pnpm-lock.yaml
git commit -m "feat(stripe): server SDK helper"
```

### Task 9.2: Checkout + portal routes

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`
- Create: `src/app/api/stripe/portal/route.ts`

- [ ] **Step 1: Checkout route**

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in?next=/pricing", req.url));

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("stripe_customer_id, email").eq("id", user.id).single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email!,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabaseAdmin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const origin = new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/account?upgraded=1`,
    cancel_url: `${origin}/pricing`,
    allow_promotion_codes: true,
  });
  return NextResponse.redirect(session.url!, { status: 303 });
}
```

- [ ] **Step 2: Portal route**

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", req.url));
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("stripe_customer_id").eq("id", user.id).single();
  if (!profile?.stripe_customer_id) return NextResponse.redirect(new URL("/account", req.url));
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: new URL("/account", req.url).toString(),
  });
  return NextResponse.redirect(session.url, { status: 303 });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/
git commit -m "feat(stripe): checkout and customer portal routes"
```

### Task 9.3: Webhook handler with idempotency

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`
- Create: `src/lib/stripe/webhook.ts`
- Create: `src/lib/stripe/webhook.test.ts`

- [ ] **Step 1: Failing test (`webhook.test.ts`)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleStripeEvent } from "./webhook";

const insertEvent = vi.fn();
const updateProfile = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "stripe_events") return { insert: (...a: unknown[]) => insertEvent(...a) };
      if (table === "profiles") return {
        update: (patch: unknown) => ({ eq: () => updateProfile(patch) }),
      };
      throw new Error("unexpected table " + table);
    },
  },
}));

beforeEach(() => { insertEvent.mockReset().mockResolvedValue({ error: null }); updateProfile.mockReset(); });

describe("handleStripeEvent", () => {
  it("upgrades plan on checkout.session.completed", async () => {
    await handleStripeEvent({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_X", subscription: "sub_Y" } },
    } as never);
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ plan: "pro" }));
  });

  it("is idempotent on duplicate event ids", async () => {
    insertEvent.mockResolvedValueOnce({ error: { code: "23505" } });
    await handleStripeEvent({
      id: "evt_1", type: "checkout.session.completed",
      data: { object: { customer: "cus_X", subscription: "sub_Y" } },
    } as never);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement (`webhook.ts`)**

```ts
import "server-only";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const insert = await supabaseAdmin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (insert.error) {
    if ((insert.error as { code?: string }).code === "23505") return; // duplicate
    throw insert.error;
  }
  switch (event.type) {
    case "checkout.session.completed": {
      const obj = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;
      await supabaseAdmin.from("profiles").update({ plan: "pro", plan_renews_at: null }).eq("stripe_customer_id", customerId);
      return;
    }
    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      const obj = event.data.object as Stripe.Subscription;
      const customerId = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;
      await supabaseAdmin.from("profiles").update({ plan: "free", plan_renews_at: null }).eq("stripe_customer_id", customerId);
      return;
    }
    case "customer.subscription.updated": {
      const obj = event.data.object as Stripe.Subscription;
      const customerId = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;
      const isActive = obj.status === "active" || obj.status === "trialing";
      await supabaseAdmin.from("profiles").update({
        plan: isActive ? "pro" : "free",
        plan_renews_at: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
      }).eq("stripe_customer_id", customerId);
      return;
    }
    default:
      return;
  }
}
```

- [ ] **Step 3: Route handler (`route.ts`)**

```ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { env } from "@/lib/env";
import { handleStripeEvent } from "@/lib/stripe/webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no signature" }, { status: 400 });
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    await handleStripeEvent(event);
  } catch (e) {
    console.error("stripe webhook handler error", e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify tests pass**

```bash
pnpm test
```

- [ ] **Step 5: Add Stripe CLI script**

`package.json`:

```json
"stripe:listen": "stripe listen --forward-to localhost:3000/api/stripe/webhook"
```

- [ ] **Step 6: Manual end-to-end with Stripe CLI**

In one terminal: `pnpm dev`. In another: `pnpm stripe:listen` (copy the printed `whsec_...` into `.env.local`'s `STRIPE_WEBHOOK_SECRET`, restart dev). Visit `/api/stripe/checkout` while signed in, complete a test checkout (card `4242 4242 4242 4242`). Confirm `profiles.plan` flips to `pro` in Studio.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/stripe/webhook src/lib/stripe/webhook.ts src/lib/stripe/webhook.test.ts package.json
git commit -m "feat(stripe): idempotent webhook syncs subscription state"
```

---

## Phase 10 — Plan gating, rate limit, bounded fan-out

**Goal:** Free users can't exceed `PLAN_FREE_MONTHLY_GENERATIONS`. `POST /api/runs` is rate-limited per user. Atomic checks — no TOCTOU.

### Task 10.1: Atomic usage cap RPC

**Files:**
- Create: `supabase/migrations/20260425000003_usage_check.sql`

- [ ] **Step 1: Write the SQL function**

```sql
-- Returns true if the user can generate `delta` more images this month, and reserves that quota.
-- For pro users (cap = 0), always returns true without recording (the workflow records actuals).
create or replace function public.try_reserve_quota(p_user_id uuid, p_delta int, p_cap int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  ym text := to_char(now(), 'YYYY-MM');
  current int;
begin
  if p_cap = 0 then
    return true;
  end if;

  insert into public.usage_monthly (user_id, year_month, generation_count)
  values (p_user_id, ym, 0)
  on conflict (user_id, year_month) do nothing;

  select generation_count into current from public.usage_monthly
    where user_id = p_user_id and year_month = ym for update;

  if current + p_delta > p_cap then
    return false;
  end if;

  update public.usage_monthly set generation_count = current + p_delta
    where user_id = p_user_id and year_month = ym;

  return true;
end;
$$;
```

- [ ] **Step 2: Apply**

```bash
pnpm db:reset
```

- [ ] **Step 3: Use it in `POST /api/runs`**

In `src/app/api/runs/route.ts`, after computing `total` and verifying `MAX_RUN_IMAGES`, add:

```ts
const { data: profile } = await supabaseAdmin
  .from("profiles").select("plan").eq("id", user.id).single();

const cap = profile?.plan === "pro"
  ? env.PLAN_PRO_MONTHLY_GENERATIONS
  : env.PLAN_FREE_MONTHLY_GENERATIONS;

const { data: ok } = await supabaseAdmin.rpc("try_reserve_quota", {
  p_user_id: user.id, p_delta: total, p_cap: cap,
});
if (!ok) {
  return NextResponse.json({ error: "Monthly limit reached. Upgrade to Pro." }, { status: 402 });
}
```

> Note: this reserves `total` slots up front. Since `processRun.finalize` also increments by `succeeded`, we now have double-counting. Adjust `finalize`: only refund failed slots (`-failed_count`) instead of incrementing succeeded.

- [ ] **Step 4: Update `processRun.finalize` to refund failures**

In `src/lib/workflows/process-run.ts`, replace the `finalize` step body with:

```ts
await step("finalize", async () => {
  const { count: failedCount } = await supabaseAdmin
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("run_id", input.runId)
    .eq("status", "failed");
  if (failedCount && failedCount > 0) {
    const ym = new Date().toISOString().slice(0, 7);
    await supabaseAdmin.rpc("increment_usage", {
      p_user_id: input.userId, p_year_month: ym, p_delta: -failedCount,
    });
  }
});
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations src/app/api/runs/route.ts src/lib/workflows/process-run.ts
git commit -m "feat(quota): atomic monthly usage cap with refund on failure"
```

### Task 10.2: Per-user rate limit on `/api/runs`

**Files:**
- Create: `src/lib/db/rate-limit.ts`
- Create: `supabase/migrations/20260425000004_rate_limit_rpc.sql`
- Modify: `src/app/api/runs/route.ts`

- [ ] **Step 1: Postgres token-bucket function**

```sql
create or replace function public.try_take_token(
  p_user_id uuid,
  p_bucket text,
  p_capacity int,
  p_refill_per_minute int
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  now_ts timestamptz := now();
  cur_tokens int;
  cur_refilled timestamptz;
  elapsed_min numeric;
  refill int;
begin
  insert into public.rate_limits (user_id, bucket, tokens, refilled_at)
  values (p_user_id, p_bucket, p_capacity, now_ts)
  on conflict (user_id, bucket) do nothing;

  select tokens, refilled_at into cur_tokens, cur_refilled
  from public.rate_limits where user_id = p_user_id and bucket = p_bucket for update;

  elapsed_min := extract(epoch from (now_ts - cur_refilled)) / 60.0;
  refill := floor(elapsed_min * p_refill_per_minute);
  if refill > 0 then
    cur_tokens := least(p_capacity, cur_tokens + refill);
    cur_refilled := now_ts;
  end if;

  if cur_tokens <= 0 then
    update public.rate_limits set tokens = cur_tokens, refilled_at = cur_refilled
      where user_id = p_user_id and bucket = p_bucket;
    return false;
  end if;

  update public.rate_limits set tokens = cur_tokens - 1, refilled_at = cur_refilled
    where user_id = p_user_id and bucket = p_bucket;
  return true;
end;
$$;
```

```bash
pnpm db:reset
```

- [ ] **Step 2: Helper (`src/lib/db/rate-limit.ts`)**

```ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function tryTakeToken(userId: string, bucket: string, capacity: number, refillPerMinute: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("try_take_token", {
    p_user_id: userId, p_bucket: bucket, p_capacity: capacity, p_refill_per_minute: refillPerMinute,
  });
  if (error) throw error;
  return Boolean(data);
}
```

- [ ] **Step 3: Use in route**

In `src/app/api/runs/route.ts`, immediately after auth:

```ts
const ok = await tryTakeToken(user.id, "runs", env.RUNS_PER_MINUTE_PER_USER, env.RUNS_PER_MINUTE_PER_USER);
if (!ok) return NextResponse.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations src/lib/db/rate-limit.ts src/app/api/runs/route.ts
git commit -m "feat(rate-limit): per-user token bucket on POST /api/runs"
```

---

## Phase 11 — `/account` page

**Goal:** Show current plan, usage this month, and a button into the Stripe portal.

### Task 11.1: Account page

**Files:**
- Create: `src/app/(app)/account/page.tsx`
- Create: `src/app/(app)/account/error.tsx`

- [ ] **Step 1: Page**

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/account");

  const { data: profile } = await supabaseAdmin.from("profiles").select("plan, stripe_customer_id, plan_renews_at").eq("id", user.id).single();
  const ym = new Date().toISOString().slice(0, 7);
  const { data: usage } = await supabaseAdmin.from("usage_monthly").select("generation_count").eq("user_id", user.id).eq("year_month", ym).maybeSingle();

  const cap = profile?.plan === "pro" ? env.PLAN_PRO_MONTHLY_GENERATIONS : env.PLAN_FREE_MONTHLY_GENERATIONS;
  const used = usage?.generation_count ?? 0;

  return (
    <div className="space-y-8 max-w-xl">
      <header>
        <h1 className="font-serif text-3xl">Account</h1>
        <p className="text-sm text-[var(--color-ink-3)]">{user.email}</p>
      </header>
      <section className="border border-[var(--color-line)] rounded p-6">
        <h2 className="font-serif text-xl mb-4">Plan</h2>
        <p className="capitalize">{profile?.plan ?? "free"}</p>
        <p className="text-sm text-[var(--color-ink-3)] mt-2">
          {used} / {cap === 0 ? "unlimited" : cap} images this month
        </p>
        <div className="mt-6 flex gap-3">
          {profile?.plan === "pro" ? (
            <a href="/api/stripe/portal" className="underline">Manage subscription</a>
          ) : (
            <a href="/api/stripe/checkout" className="bg-[var(--color-ember)] text-white px-4 py-2 rounded">Upgrade to Pro</a>
          )}
          <form action="/api/auth/sign-out" method="post">
            <button className="underline text-[var(--color-ink-3)]">Sign out</button>
          </form>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Error boundary** (mirror `/app/error.tsx`).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/account
git commit -m "feat(account): plan + usage display, portal/upgrade entry points"
```

---

## Phase 12 — Tests, dev tooling, setup doc

**Goal:** A new contributor can clone, read `docs/setup.md`, run a few commands, and have everything running locally. Playwright smoke test runs in CI without Sceneify or Stripe (mocked).

### Task 12.1: `pnpm dev:all` (concurrently)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
pnpm add -D concurrently
```

- [ ] **Step 2: Add scripts**

```json
"dev:all": "concurrently -n next,stripe -c blue,magenta \"pnpm dev\" \"pnpm stripe:listen\""
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: dev:all runs next + stripe listener concurrently"
```

### Task 12.2: Playwright smoke test

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`

- [ ] **Step 1: Install**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Config**

```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: true,
    env: {
      SCENEIFY_API_URL: "http://localhost:4444",
    },
  },
  use: { baseURL: "http://localhost:3000" },
});
```

- [ ] **Step 3: Smoke test**

For now, write a minimal test that just visits `/` and `/pricing` and asserts the page renders. End-to-end of upload→generate is hard to mock without standing up a real fake Sceneify server; defer the full flow test until after MVP is shipped.

```ts
import { test, expect } from "@playwright/test";

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toContainText("Darkroom");
});

test("pricing page shows plan numbers", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator("body")).toContainText("Free");
  await expect(page.locator("body")).toContainText("Pro");
});
```

- [ ] **Step 4: Add script**

`package.json`:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 5: Commit**

```bash
git add e2e/ playwright.config.ts package.json pnpm-lock.yaml .gitignore
git commit -m "chore: playwright smoke tests for marketing pages"
```

### Task 12.3: Setup doc

**Files:**
- Create: `docs/setup.md`

- [ ] **Step 1: Write the doc**

```markdown
# Local setup

## Prereqs

- Node 20+
- pnpm 9+
- Docker (for Sceneify)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Stripe CLI (`brew install stripe/stripe-cli/stripe`)

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
   Copy the printed `anon key` and `service_role key` into `.env.local`.
4. Sign in to Stripe (test mode):
   ```
   stripe login
   ```
5. Create a Pro test product/price in your Stripe test dashboard and put the price ID in `STRIPE_PRO_PRICE_ID`.
6. Start Sceneify in Docker on `:8080` (separate repo). Confirm `curl http://localhost:8080/api/presets` returns presets.

## Daily

```
pnpm dev:all       # next + stripe webhook listener
```

In a third terminal, when needed:
```
pnpm db:status     # check supabase
```

## Common tasks

- Reset DB: `pnpm db:reset`
- Run unit tests: `pnpm test`
- Run e2e: `pnpm test:e2e`
- Lint + typecheck: `pnpm lint`

## Troubleshooting

- **Sceneify unreachable**: confirm container is running and `SCENEIFY_API_URL` matches.
- **Stripe webhook signature invalid**: when `pnpm stripe:listen` starts it prints a `whsec_...` — copy it into `.env.local` and restart `pnpm dev`.
- **Supabase ports in use**: `pnpm db:stop` then `pnpm db:start`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/setup.md
git commit -m "docs: local setup guide"
```

---

## Self-review notes (already addressed)

- Plan numbers are placeholders in `.env.local.example`; flagged at top of plan and in env file.
- WDK API surface intentionally noted as version-dependent in Task 4.2 — adjust at execution time per the `vercel:workflow` skill.
- Quota reservation in Phase 10 changes the meaning of `processRun.finalize` from "increment succeeded" to "refund failed"; both spots updated together.
- Watermark wiring in Phase 8 reads the user's plan inside the workflow (correctly), not at /api/runs time, so a plan change between request and run is honored.
- All `lib/` modules that touch external services or DB get `import "server-only"`.
- RLS policies cover every user-owned table; `stripe_events` is service-role only.
- Indexes added in Task 2.2 cover the polling query (`generations.run_id`), history view (`user_id, created_at`), and webhook lookup (`profiles.stripe_customer_id` unique).
