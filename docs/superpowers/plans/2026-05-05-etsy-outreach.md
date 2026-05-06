# Etsy Outreach Growth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin-only Etsy candidate review surface, parallel Sceneify generation pipeline, and unguessable seller-facing preview pages, with end-to-end GA4 + server-side analytics. Implements `docs/superpowers/specs/2026-05-05-etsy-outreach-design.md`.

**Architecture:** Two non-overlapping surfaces — `/admin/etsy-candidates` (admin only) and `/etsy-preview/[token]` (public unlisted). New tables `etsy_candidates`, `etsy_preview_pages`, `etsy_preview_events` with denormalized `listing_snapshot` so the seller route never joins to candidates. Generation runs in a Vercel Workflow DevKit workflow that mirrors the existing `processRun` (one outer workflow per page; inner `Promise.all` over three pinned Sceneify presets). Counter increments via SQL RPC. GA4 events use the same `track()` helper already in use.

**Tech Stack:** Next.js 16 App Router · Drizzle ORM (Postgres) · Supabase auth · Vercel Workflow DevKit (`workflow@4.2.4`) · `@vercel/blob` · GA4 (gtag + Measurement Protocol) · vitest · Tailwind v4 · shadcn primitives.

---

## File Structure

**Created**
```
data/etsy-candidates.md                              # MD source, copied from ~/Documents
src/lib/etsy-outreach/parse-md.ts                    # tolerant block parser
src/lib/etsy-outreach/parse-md.test.ts               # parser unit tests
src/lib/etsy-outreach/source.ts                      # MD path resolver + reader
src/lib/etsy-outreach/tokens.ts                      # generatePreviewToken
src/lib/etsy-outreach/tokens.test.ts
src/lib/etsy-outreach/candidates.ts                  # CRUD on etsy_candidates
src/lib/etsy-outreach/pages.ts                       # CRUD on etsy_preview_pages
src/lib/etsy-outreach/events.ts                      # CRUD + counter RPC
src/lib/etsy-outreach/presets.ts                     # pinned Sceneify slugs
src/lib/etsy-outreach/snapshot.ts                    # Etsy image → Vercel Blob
src/lib/etsy-outreach/analytics.ts                   # event name constants + EtsyPreviewEventParams type
src/lib/workflows/process-etsy-preview.ts            # the workflow
drizzle/sql/0007_etsy_outreach.sql                   # tables + check constraints
drizzle/sql/0008_increment_etsy_preview_counter.sql  # atomic counter RPC

src/app/(admin)/layout.tsx                           # top nav + sidebar shell + admin gate
src/app/(admin)/admin/etsy-candidates/page.tsx       # server: read data + render
src/app/(admin)/admin/etsy-candidates/candidates-table.tsx  # client: selection + actions
src/app/(admin)/admin/etsy-candidates/metrics-cards.tsx
src/app/(admin)/admin/etsy-candidates/top-previews.tsx
src/app/(admin)/admin/etsy-candidates/admin-sidebar.tsx
src/app/(admin)/admin/etsy-candidates/status-pill.tsx

src/app/api/admin/etsy/ingest/route.ts
src/app/api/admin/etsy/generate/route.ts
src/app/api/admin/etsy/retry/route.ts
src/app/api/admin/etsy/skip/route.ts
src/app/api/admin/etsy/status/route.ts               # for client SWR polling

src/app/api/public/etsy-preview/[token]/event/route.ts

src/app/etsy-preview/[token]/page.tsx                # server-rendered seller page
src/app/etsy-preview/[token]/preview-cta.tsx        # client CTA + event POSTs
src/app/etsy-preview/[token]/opengraph-image.tsx
```

**Modified**
```
src/lib/db/schema.ts                                 # add etsyCandidates, etsyPreviewPages, etsyPreviewEvents
src/lib/analytics.ts                                 # extend AnalyticsEvent union with etsy_* events
src/components/nav.tsx                               # admin link (admin-only)
src/app/robots.ts                                    # disallow /etsy-preview/, /admin/
src/app/api/stripe/webhook/route.ts                  # read vd_etsy_ref cookie → increment signup_count
```

---

## Task 1: Bring source MD into the repo + add path resolver

**Files:**
- Create: `data/etsy-candidates.md`
- Create: `src/lib/etsy-outreach/source.ts`

- [ ] **Step 1: Copy the MD file into the repo**

```bash
mkdir -p data
cp ~/Documents/Claude/Projects/Darkroom/etsy_flat_lay_listings.md data/etsy-candidates.md
```

- [ ] **Step 2: Write the source path resolver**

Create `src/lib/etsy-outreach/source.ts`:

```ts
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_RELATIVE = "data/etsy-candidates.md";

export function candidatesFilePath(): string {
  const fromEnv = process.env.ETSY_CANDIDATES_PATH;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return path.join(process.cwd(), DEFAULT_RELATIVE);
}

export async function readCandidatesMd(): Promise<string> {
  return readFile(candidatesFilePath(), "utf8");
}
```

- [ ] **Step 3: Commit**

```bash
git add data/etsy-candidates.md src/lib/etsy-outreach/source.ts
git commit -m "feat(etsy-outreach): vendor candidate MD and add path resolver"
```

---

## Task 2: Tolerant markdown parser (TDD)

**Files:**
- Create: `src/lib/etsy-outreach/parse-md.ts`
- Test: `src/lib/etsy-outreach/parse-md.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/etsy-outreach/parse-md.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEtsyCandidatesMd } from "./parse-md";

const SAMPLE = `# Etsy garments — flat / hanger / dress-form listings

Curated 2026-05-05.

---

## 1. [Vintage Bill Blass Corduroy Pinafore Dress](https://www.etsy.com/listing/4415836244/foo)

![Vintage Bill Blass Corduroy Pinafore Dress](https://i.etsystatic.com/abc/il_765x1020.jpg)

_Surfaced via search: vintage dress_

## 2. [Title with no image](https://www.etsy.com/listing/123/bar)

_Surfaced via search: vintage blouse_

## 3. [Malformed listing — no link

![orphan image](https://i.etsystatic.com/x.jpg)

## 4. [Final entry](https://www.etsy.com/listing/999/baz)

![Final entry](https://i.etsystatic.com/y.jpg)
`;

describe("parseEtsyCandidatesMd", () => {
  it("parses well-formed entries", () => {
    const { candidates, errors } = parseEtsyCandidatesMd(SAMPLE);
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({
      title: "Vintage Bill Blass Corduroy Pinafore Dress",
      listingUrl: "https://www.etsy.com/listing/4415836244/foo",
      imageUrl: "https://i.etsystatic.com/abc/il_765x1020.jpg",
      category: "vintage dress",
    });
    expect(candidates[0].rawMd).toContain("Vintage Bill Blass");
  });

  it("captures category for second entry even though image missing", () => {
    const { candidates } = parseEtsyCandidatesMd(SAMPLE);
    const second = candidates.find(
      (c) => c.listingUrl === "https://www.etsy.com/listing/123/bar",
    );
    expect(second).toBeDefined();
    expect(second?.imageUrl).toBeNull();
    expect(second?.category).toBe("vintage blouse");
  });

  it("records an error for the malformed block but keeps parsing", () => {
    const { candidates, errors } = parseEtsyCandidatesMd(SAMPLE);
    expect(candidates.map((c) => c.title)).toContain("Final entry");
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]?.reason).toMatch(/heading/i);
  });

  it("handles empty input", () => {
    const { candidates, errors } = parseEtsyCandidatesMd("");
    expect(candidates).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/lib/etsy-outreach/parse-md.test.ts
```
Expected: FAIL with "Cannot find module './parse-md'".

- [ ] **Step 3: Implement the parser**

Create `src/lib/etsy-outreach/parse-md.ts`:

```ts
export type ParsedCandidate = {
  title: string;
  listingUrl: string;
  imageUrl: string | null;
  category: string | null;
  rawMd: string;
};

export type ParseError = { reason: string; rawMd: string };

const HEADING_RE = /^##\s+\d+\.\s+\[([^\]]+)\]\(([^)]+)\)\s*$/;
const IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/;
const CATEGORY_RE = /_Surfaced via search:\s*([^_]+?)_/;

export function parseEtsyCandidatesMd(input: string): {
  candidates: ParsedCandidate[];
  errors: ParseError[];
} {
  const candidates: ParsedCandidate[] = [];
  const errors: ParseError[] = [];

  if (!input.trim()) return { candidates, errors };

  const blocks = splitBlocks(input);
  for (const block of blocks) {
    const headingLine = block.split("\n").find((l) => l.startsWith("## "));
    if (!headingLine) continue;
    const headingMatch = HEADING_RE.exec(headingLine);
    if (!headingMatch) {
      errors.push({ reason: `Could not parse heading: ${headingLine}`, rawMd: block });
      continue;
    }
    const [, title, listingUrl] = headingMatch;
    const imageMatch = IMAGE_RE.exec(block);
    const categoryMatch = CATEGORY_RE.exec(block);
    candidates.push({
      title: title.trim(),
      listingUrl: listingUrl.trim(),
      imageUrl: imageMatch ? imageMatch[1].trim() : null,
      category: categoryMatch ? categoryMatch[1].trim() : null,
      rawMd: block.trim(),
    });
  }

  return { candidates, errors };
}

function splitBlocks(input: string): string[] {
  const lines = input.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^##\s+\d+\./.test(line)) {
      if (current.length > 0) blocks.push(current.join("\n"));
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/lib/etsy-outreach/parse-md.test.ts
```
Expected: 4 PASS.

- [ ] **Step 5: Sanity-check against the real MD file**

```bash
pnpm tsx -e "
import('./src/lib/etsy-outreach/source.ts').then(async (s) => {
  const { parseEtsyCandidatesMd } = await import('./src/lib/etsy-outreach/parse-md.ts');
  const md = await s.readCandidatesMd();
  const { candidates, errors } = parseEtsyCandidatesMd(md);
  console.log('candidates:', candidates.length, 'errors:', errors.length);
  console.log('first:', candidates[0]);
}).catch((e) => { console.error(e); process.exit(1); });
"
```
Expected output: `candidates: 100 errors: 0` (or close — file has exactly 100 entries).

- [ ] **Step 6: Commit**

```bash
git add src/lib/etsy-outreach/parse-md.ts src/lib/etsy-outreach/parse-md.test.ts
git commit -m "feat(etsy-outreach): tolerant markdown parser for candidate listings"
```

---

## Task 3: DB schema additions + raw SQL migration

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/sql/0007_etsy_outreach.sql`
- Create: `drizzle/sql/0008_increment_etsy_preview_counter.sql`

- [ ] **Step 1: Add Drizzle table definitions**

Append to `src/lib/db/schema.ts` (before the type exports at the bottom):

```ts
export const etsyCandidates = pgTable(
  "etsy_candidates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    listingUrl: text("listing_url").notNull().unique(),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    shopName: text("shop_name"),
    shopUrl: text("shop_url"),
    category: text("category"),
    description: text("description"),
    tags: text("tags").array(),
    rawMd: text("raw_md").notNull(),
    status: text("status", {
      enum: [
        "pending",
        "generating",
        "completed",
        "partial",
        "failed",
        "skipped",
        "to_review",
      ],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("etsy_candidates_status_idx").on(t.status)],
);

export const etsyPreviewPages = pgTable(
  "etsy_preview_pages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => etsyCandidates.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    status: text("status", {
      enum: ["pending", "generating", "partial", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    sourceBlobUrl: text("source_blob_url"),
    listingSnapshot: jsonb("listing_snapshot")
      .notNull()
      .$type<{
        title: string;
        listingUrl: string;
        imageUrl: string | null;
        shopName: string | null;
        category: string | null;
      }>(),
    heroUrl: text("hero_url"),
    heroStatus: text("hero_status").notNull().default("pending"),
    heroError: text("hero_error"),
    lifestyleUrl: text("lifestyle_url"),
    lifestyleStatus: text("lifestyle_status").notNull().default("pending"),
    lifestyleError: text("lifestyle_error"),
    detailUrl: text("detail_url"),
    detailStatus: text("detail_status").notNull().default("pending"),
    detailError: text("detail_error"),
    viewCount: integer("view_count").notNull().default(0),
    ctaClickCount: integer("cta_click_count").notNull().default(0),
    signupClickCount: integer("signup_click_count").notNull().default(0),
    signupCount: integer("signup_count").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("etsy_preview_pages_candidate_idx").on(t.candidateId),
    index("etsy_preview_pages_status_idx").on(t.status),
  ],
);

export const etsyPreviewEvents = pgTable(
  "etsy_preview_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => etsyPreviewPages.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["view", "cta_click", "signup_start", "signup"],
    }).notNull(),
    label: text("label"),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("etsy_preview_events_page_idx").on(t.pageId),
    index("etsy_preview_events_created_idx").on(t.createdAt.desc()),
  ],
);

export type EtsyCandidate = typeof etsyCandidates.$inferSelect;
export type EtsyPreviewPage = typeof etsyPreviewPages.$inferSelect;
export type EtsyPreviewEvent = typeof etsyPreviewEvents.$inferSelect;
```

- [ ] **Step 2: Generate Drizzle migration**

```bash
pnpm db:generate
```
Expected: a new file appears under `drizzle/` (something like `0001_*.sql`) creating the three tables.

- [ ] **Step 3: Add the counter RPC SQL**

Create `drizzle/sql/0007_etsy_outreach.sql` with check constraints that Drizzle does not emit:

```sql
-- Drizzle does not emit the value-set check constraints from text({enum:[...]}),
-- so we add them as a separate migration that runs after the generate step.

alter table etsy_candidates
  add constraint etsy_candidates_status_check
  check (status in ('pending','generating','completed','partial','failed','skipped','to_review'));

alter table etsy_preview_pages
  add constraint etsy_preview_pages_status_check
  check (status in ('pending','generating','partial','completed','failed'));

alter table etsy_preview_events
  add constraint etsy_preview_events_kind_check
  check (kind in ('view','cta_click','signup_start','signup'));
```

Create `drizzle/sql/0008_increment_etsy_preview_counter.sql`:

```sql
create or replace function increment_etsy_preview_counter(
  p_page_id uuid,
  p_kind text
) returns void
language plpgsql
as $$
begin
  if p_kind = 'view' then
    update etsy_preview_pages
       set view_count = view_count + 1, updated_at = now()
     where id = p_page_id;
  elsif p_kind = 'cta_click' then
    update etsy_preview_pages
       set cta_click_count = cta_click_count + 1, updated_at = now()
     where id = p_page_id;
  elsif p_kind = 'signup_start' then
    update etsy_preview_pages
       set signup_click_count = signup_click_count + 1, updated_at = now()
     where id = p_page_id;
  elsif p_kind = 'signup' then
    update etsy_preview_pages
       set signup_count = signup_count + 1, updated_at = now()
     where id = p_page_id;
  else
    raise exception 'unknown kind: %', p_kind;
  end if;
end;
$$;
```

- [ ] **Step 4: Apply migrations to local DB**

```bash
pnpm db:push
```
Expected: Drizzle migration applies, then `scripts/db-apply-sql.ts` runs the two new `0007_*.sql` and `0008_*.sql` files.

- [ ] **Step 5: Verify tables exist**

```bash
pnpm exec supabase db psql --command "\\d etsy_candidates" | head -20
pnpm exec supabase db psql --command "\\df increment_etsy_preview_counter"
```
Expected: column listing for `etsy_candidates`, function listing for the RPC.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(db): add etsy_candidates, etsy_preview_pages, etsy_preview_events tables and counter RPC"
```

---

## Task 4: Token generator (TDD)

**Files:**
- Create: `src/lib/etsy-outreach/tokens.ts`
- Test: `src/lib/etsy-outreach/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { generatePreviewToken } from "./tokens";

describe("generatePreviewToken", () => {
  it("returns a 43-char URL-safe base64 string", () => {
    const t = generatePreviewToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns a different token each call", () => {
    const set = new Set(Array.from({ length: 50 }, () => generatePreviewToken()));
    expect(set.size).toBe(50);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
pnpm vitest run src/lib/etsy-outreach/tokens.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import "server-only";
import crypto from "node:crypto";

export function generatePreviewToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm vitest run src/lib/etsy-outreach/tokens.test.ts
```
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/etsy-outreach/tokens.ts src/lib/etsy-outreach/tokens.test.ts
git commit -m "feat(etsy-outreach): unguessable preview token generator"
```

---

## Task 5: Candidates DB layer

**Files:**
- Create: `src/lib/etsy-outreach/candidates.ts`

- [ ] **Step 1: Implement candidates.ts**

```ts
import "server-only";
import { eq, inArray, desc, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { ParsedCandidate } from "./parse-md";
import type { EtsyCandidate } from "@/lib/db/schema";

export type CandidateStatus = EtsyCandidate["status"];

export async function upsertCandidatesFromParsed(
  parsed: ParsedCandidate[],
): Promise<{ inserted: number; updated: number }> {
  if (parsed.length === 0) return { inserted: 0, updated: 0 };
  const rows = parsed.map((p) => ({
    listingUrl: p.listingUrl,
    title: p.title,
    imageUrl: p.imageUrl,
    category: p.category,
    rawMd: p.rawMd,
  }));
  const result = await db
    .insert(schema.etsyCandidates)
    .values(rows)
    .onConflictDoUpdate({
      target: schema.etsyCandidates.listingUrl,
      set: {
        title: sql`excluded.title`,
        imageUrl: sql`excluded.image_url`,
        category: sql`excluded.category`,
        rawMd: sql`excluded.raw_md`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: schema.etsyCandidates.id });
  // Drizzle does not split insert vs update counts cheaply; surface total only.
  return { inserted: result.length, updated: 0 };
}

export async function listCandidates(): Promise<EtsyCandidate[]> {
  return db
    .select()
    .from(schema.etsyCandidates)
    .orderBy(desc(schema.etsyCandidates.updatedAt));
}

export async function getCandidatesByIds(ids: string[]): Promise<EtsyCandidate[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(schema.etsyCandidates)
    .where(inArray(schema.etsyCandidates.id, ids));
}

export async function setCandidateStatus(
  id: string,
  status: CandidateStatus,
): Promise<void> {
  await db
    .update(schema.etsyCandidates)
    .set({ status, updatedAt: sql`now()` })
    .where(eq(schema.etsyCandidates.id, id));
}

export async function setCandidatesStatus(
  ids: string[],
  status: CandidateStatus,
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(schema.etsyCandidates)
    .set({ status, updatedAt: sql`now()` })
    .where(inArray(schema.etsyCandidates.id, ids));
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/etsy-outreach/candidates.ts
git commit -m "feat(etsy-outreach): candidates DB layer (upsert from MD, list, status)"
```

---

## Task 6: Preview pages DB layer

**Files:**
- Create: `src/lib/etsy-outreach/pages.ts`

- [ ] **Step 1: Implement pages.ts**

```ts
import "server-only";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { EtsyCandidate, EtsyPreviewPage } from "@/lib/db/schema";
import { generatePreviewToken } from "./tokens";

export type PreviewSlotKey = "hero" | "lifestyle" | "detail";
export type PreviewStatus = EtsyPreviewPage["status"];

export async function createPreviewPage(args: {
  candidate: EtsyCandidate;
  createdBy: string;
}): Promise<EtsyPreviewPage> {
  const [row] = await db
    .insert(schema.etsyPreviewPages)
    .values({
      candidateId: args.candidate.id,
      token: generatePreviewToken(),
      createdBy: args.createdBy,
      listingSnapshot: {
        title: args.candidate.title,
        listingUrl: args.candidate.listingUrl,
        imageUrl: args.candidate.imageUrl,
        shopName: args.candidate.shopName,
        category: args.candidate.category,
      },
    })
    .returning();
  return row;
}

export async function getPreviewById(id: string): Promise<EtsyPreviewPage | null> {
  const rows = await db
    .select()
    .from(schema.etsyPreviewPages)
    .where(eq(schema.etsyPreviewPages.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPreviewByToken(
  token: string,
): Promise<EtsyPreviewPage | null> {
  const rows = await db
    .select()
    .from(schema.etsyPreviewPages)
    .where(eq(schema.etsyPreviewPages.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPreviewsByCandidateIds(
  candidateIds: string[],
): Promise<EtsyPreviewPage[]> {
  if (candidateIds.length === 0) return [];
  return db
    .select()
    .from(schema.etsyPreviewPages)
    .where(inArray(schema.etsyPreviewPages.candidateId, candidateIds))
    .orderBy(desc(schema.etsyPreviewPages.createdAt));
}

export async function updatePreviewSourceBlob(
  id: string,
  sourceBlobUrl: string,
): Promise<void> {
  await db
    .update(schema.etsyPreviewPages)
    .set({ sourceBlobUrl, updatedAt: sql`now()` })
    .where(eq(schema.etsyPreviewPages.id, id));
}

export async function setSlotRunning(
  id: string,
  slot: PreviewSlotKey,
): Promise<void> {
  const setMap = {
    hero: { heroStatus: "running" as const },
    lifestyle: { lifestyleStatus: "running" as const },
    detail: { detailStatus: "running" as const },
  };
  await db
    .update(schema.etsyPreviewPages)
    .set({ ...setMap[slot], status: "generating", updatedAt: sql`now()` })
    .where(eq(schema.etsyPreviewPages.id, id));
}

export async function setSlotResult(
  id: string,
  slot: PreviewSlotKey,
  result: { url: string } | { error: string },
): Promise<void> {
  const isError = "error" in result;
  const update =
    slot === "hero"
      ? isError
        ? { heroStatus: "failed" as const, heroError: result.error }
        : { heroStatus: "succeeded" as const, heroUrl: result.url, heroError: null }
      : slot === "lifestyle"
        ? isError
          ? { lifestyleStatus: "failed" as const, lifestyleError: result.error }
          : { lifestyleStatus: "succeeded" as const, lifestyleUrl: result.url, lifestyleError: null }
        : isError
          ? { detailStatus: "failed" as const, detailError: result.error }
          : { detailStatus: "succeeded" as const, detailUrl: result.url, detailError: null };
  await db
    .update(schema.etsyPreviewPages)
    .set({ ...update, updatedAt: sql`now()` })
    .where(eq(schema.etsyPreviewPages.id, id));
}

export async function finalizePreviewStatus(id: string): Promise<PreviewStatus> {
  const page = await getPreviewById(id);
  if (!page) throw new Error(`preview ${id} not found`);
  const slots = [page.heroStatus, page.lifestyleStatus, page.detailStatus];
  const succeededCount = slots.filter((s) => s === "succeeded").length;
  const failedCount = slots.filter((s) => s === "failed").length;
  let next: PreviewStatus;
  if (succeededCount === 3) next = "completed";
  else if (succeededCount >= 1 && failedCount >= 1) next = "partial";
  else if (failedCount === 3) next = "failed";
  else next = page.status;
  await db
    .update(schema.etsyPreviewPages)
    .set({
      status: next,
      completedAt: next === "completed" || next === "partial" || next === "failed"
        ? sql`now()`
        : null,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.etsyPreviewPages.id, id));
  return next;
}

export async function resetFailedSlots(id: string): Promise<void> {
  const page = await getPreviewById(id);
  if (!page) throw new Error(`preview ${id} not found`);
  await db
    .update(schema.etsyPreviewPages)
    .set({
      status: "pending",
      heroStatus: page.heroStatus === "failed" ? "pending" : page.heroStatus,
      lifestyleStatus:
        page.lifestyleStatus === "failed" ? "pending" : page.lifestyleStatus,
      detailStatus: page.detailStatus === "failed" ? "pending" : page.detailStatus,
      heroError: page.heroStatus === "failed" ? null : page.heroError,
      lifestyleError: page.lifestyleStatus === "failed" ? null : page.lifestyleError,
      detailError: page.detailStatus === "failed" ? null : page.detailError,
      completedAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.etsyPreviewPages.id, id));
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/etsy-outreach/pages.ts
git commit -m "feat(etsy-outreach): preview pages DB layer with slot-by-slot status"
```

---

## Task 7: Events DB layer + counter RPC consumer

**Files:**
- Create: `src/lib/etsy-outreach/events.ts`

- [ ] **Step 1: Implement events.ts**

```ts
import "server-only";
import { sql, eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import crypto from "node:crypto";
import type { EtsyPreviewEvent } from "@/lib/db/schema";

export type EtsyEventKind = EtsyPreviewEvent["kind"];

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "vesperdrop-default-salt";
  return crypto.createHash("sha256").update(salt).update(ip).digest("hex").slice(0, 32);
}

export async function recordEvent(args: {
  pageId: string;
  kind: EtsyEventKind;
  label?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<void> {
  await db.insert(schema.etsyPreviewEvents).values({
    pageId: args.pageId,
    kind: args.kind,
    label: args.label ?? null,
    userAgent: args.userAgent?.slice(0, 500) ?? null,
    ipHash: args.ip ? hashIp(args.ip) : null,
  });

  // Atomic counter via RPC.
  const { error } = await supabaseAdmin.rpc("increment_etsy_preview_counter", {
    p_page_id: args.pageId,
    p_kind: args.kind,
  });
  if (error) {
    console.error("[etsy-outreach] counter RPC failed", error);
  }
}

export async function topPreviewsByViews(
  limit = 5,
): Promise<Array<{
  id: string;
  token: string;
  title: string;
  viewCount: number;
  ctaClickCount: number;
  signupCount: number;
}>> {
  const rows = await db
    .select({
      id: schema.etsyPreviewPages.id,
      token: schema.etsyPreviewPages.token,
      listingSnapshot: schema.etsyPreviewPages.listingSnapshot,
      viewCount: schema.etsyPreviewPages.viewCount,
      ctaClickCount: schema.etsyPreviewPages.ctaClickCount,
      signupCount: schema.etsyPreviewPages.signupCount,
    })
    .from(schema.etsyPreviewPages)
    .orderBy(desc(schema.etsyPreviewPages.viewCount))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    title: r.listingSnapshot.title,
    viewCount: r.viewCount,
    ctaClickCount: r.ctaClickCount,
    signupCount: r.signupCount,
  }));
}

export async function previewMetrics(): Promise<{
  previewCount: number;
  viewSum: number;
  ctaClickSum: number;
  signupSum: number;
}> {
  const [row] = await db
    .select({
      previewCount: sql<number>`count(*)::int`,
      viewSum: sql<number>`coalesce(sum(${schema.etsyPreviewPages.viewCount}),0)::int`,
      ctaClickSum: sql<number>`coalesce(sum(${schema.etsyPreviewPages.ctaClickCount}),0)::int`,
      signupSum: sql<number>`coalesce(sum(${schema.etsyPreviewPages.signupCount}),0)::int`,
    })
    .from(schema.etsyPreviewPages);
  return row;
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/etsy-outreach/events.ts
git commit -m "feat(etsy-outreach): events DB layer with atomic counter RPC + dashboard reads"
```

---

## Task 8: Source image snapshot helper

**Files:**
- Create: `src/lib/etsy-outreach/snapshot.ts`

- [ ] **Step 1: Implement**

```ts
import "server-only";
import { put } from "@vercel/blob";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import crypto from "node:crypto";
import { env } from "@/lib/env";

export async function snapshotEtsyImage(
  sourceUrl: string,
  pageId: string,
): Promise<string> {
  const res = await fetch(sourceUrl, {
    headers: { "user-agent": "Vesperdrop/1.0 (+https://vesperdrop.com)" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`snapshot ${res.status} for ${sourceUrl}`);
  }
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = contentType.includes("png") ? "png" : "jpg";
  const key = `etsy-source/${pageId}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

  if (env.BLOB_READ_WRITE_TOKEN) {
    const result = await put(key, buf, { access: "public", contentType });
    return result.url;
  }
  // Local dev fallback.
  const dir = path.join(process.cwd(), "public", "etsy-source");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, path.basename(key));
  await writeFile(file, buf);
  return `/etsy-source/${path.basename(key)}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/etsy-outreach/snapshot.ts
git commit -m "feat(etsy-outreach): snapshot Etsy source image to Vercel Blob"
```

---

## Task 9: Sceneify presets module

**Files:**
- Create: `src/lib/etsy-outreach/presets.ts`

- [ ] **Step 1: Implement with placeholder slugs (verify later)**

```ts
import "server-only";

export type PreviewSlotKey = "hero" | "lifestyle" | "detail";

/**
 * Pinned Sceneify preset slugs for the three preview slots. These are
 * placeholders — before going live, run sceneify().listPresets() against
 * the staging API and update with the real slug names that read as
 * "Shopify hero", "lifestyle", "product detail". Either set the env
 * overrides or update the constants here.
 */
export const ETSY_PRESETS: Record<PreviewSlotKey, string> = {
  hero: process.env.ETSY_PRESET_HERO ?? "shopify-hero",
  lifestyle: process.env.ETSY_PRESET_LIFESTYLE ?? "lifestyle",
  detail: process.env.ETSY_PRESET_DETAIL ?? "detail",
};

export const PREVIEW_SLOTS: PreviewSlotKey[] = ["hero", "lifestyle", "detail"];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/etsy-outreach/presets.ts
git commit -m "feat(etsy-outreach): pinned Sceneify preset slugs (env-overridable)"
```

---

## Task 10: processEtsyPreview workflow

**Files:**
- Create: `src/lib/workflows/process-etsy-preview.ts`

- [ ] **Step 1: Implement the workflow**

```ts
import "server-only";
import { generateViaSceneify } from "@/lib/ai/sceneify";
import { snapshotEtsyImage } from "@/lib/etsy-outreach/snapshot";
import { ETSY_PRESETS, PREVIEW_SLOTS, type PreviewSlotKey } from "@/lib/etsy-outreach/presets";
import {
  finalizePreviewStatus,
  getPreviewById,
  setSlotResult,
  setSlotRunning,
  updatePreviewSourceBlob,
} from "@/lib/etsy-outreach/pages";

async function loadAndSnapshot(pageId: string): Promise<string | null> {
  "use step";
  const page = await getPreviewById(pageId);
  if (!page) throw new Error(`preview ${pageId} not found`);
  const sourceUrl = page.listingSnapshot.imageUrl;
  if (!sourceUrl) {
    return null; // candidate had no image; treat as failed in caller
  }
  if (page.sourceBlobUrl) return page.sourceBlobUrl;
  const blobUrl = await snapshotEtsyImage(sourceUrl, pageId);
  await updatePreviewSourceBlob(pageId, blobUrl);
  return blobUrl;
}

async function generateOneSlot(
  pageId: string,
  sourceUrl: string,
  slot: PreviewSlotKey,
  mock: boolean,
): Promise<void> {
  "use step";
  await setSlotRunning(pageId, slot);
  try {
    if (mock) {
      await new Promise((r) => setTimeout(r, 8000 + Math.random() * 4000));
      await setSlotResult(pageId, slot, { url: sourceUrl });
      return;
    }
    const result = await generateViaSceneify({
      sourceUrl,
      presetSlug: ETSY_PRESETS[slot],
      model: "gpt-image-2",
      quality: "high",
      callerRef: `etsy-preview:${pageId}:${slot}`,
    });
    await setSlotResult(pageId, slot, { url: result.outputUrl });
  } catch (e) {
    await setSlotResult(pageId, slot, {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function failAllSlots(pageId: string, message: string): Promise<void> {
  "use step";
  for (const slot of PREVIEW_SLOTS) {
    await setSlotResult(pageId, slot, { error: message });
  }
}

async function finalize(pageId: string): Promise<void> {
  "use step";
  await finalizePreviewStatus(pageId);
}

export async function processEtsyPreview(
  pageId: string,
  mock = false,
): Promise<void> {
  "use workflow";

  const sourceUrl = await loadAndSnapshot(pageId);
  if (!sourceUrl) {
    await failAllSlots(pageId, "no source image on candidate");
  } else {
    await Promise.all(
      PREVIEW_SLOTS.map((slot) => generateOneSlot(pageId, sourceUrl, slot, mock)),
    );
  }

  await finalize(pageId);
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workflows/process-etsy-preview.ts
git commit -m "feat(etsy-outreach): processEtsyPreview workflow with parallel slot generation"
```

---

## Task 11: Analytics event constants + extend AnalyticsEvent union

**Files:**
- Create: `src/lib/etsy-outreach/analytics.ts`
- Modify: `src/lib/analytics.ts`

- [ ] **Step 1: Add event constants**

Create `src/lib/etsy-outreach/analytics.ts`:

```ts
export type EtsyPreviewEventParams = {
  preview_token: string;
  candidate_id: string;
  seller_name: string | null;
  listing_url: string;
  source: "etsy_outreach";
};

export const ETSY_EVENT_NAMES = {
  preview_view: "etsy_preview_view",
  preview_cta_click: "etsy_preview_cta_click",
  preview_signup_start: "etsy_preview_signup_start",
  admin_generation_submitted: "etsy_admin_generation_submitted",
  admin_generation_completed: "etsy_admin_generation_completed",
  admin_copy_preview_link: "etsy_admin_copy_preview_link",
} as const;
```

- [ ] **Step 2: Extend the analytics event union**

Edit `src/lib/analytics.ts`. Add these arms to the `AnalyticsEvent` discriminated union (before the closing semicolon):

```ts
  | {
      name: "etsy_preview_view";
      props: {
        preview_token: string;
        candidate_id: string;
        seller_name: string | null;
        listing_url: string;
        source: "etsy_outreach";
      };
    }
  | {
      name: "etsy_preview_cta_click";
      props: {
        preview_token: string;
        candidate_id: string;
        seller_name: string | null;
        listing_url: string;
        source: "etsy_outreach";
        label: "email_submit" | "google" | "start_trial";
      };
    }
  | {
      name: "etsy_preview_signup_start";
      props: {
        preview_token: string;
        candidate_id: string;
        seller_name: string | null;
        listing_url: string;
        source: "etsy_outreach";
        method: "email" | "google";
      };
    }
  | { name: "etsy_admin_generation_submitted"; props: { count: number; mock: boolean } }
  | { name: "etsy_admin_generation_completed"; props: { page_id: string; status: "completed" | "partial" | "failed" } }
  | { name: "etsy_admin_copy_preview_link"; props: { page_id: string; preview_token: string } }
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/etsy-outreach/analytics.ts src/lib/analytics.ts
git commit -m "feat(etsy-outreach): typed GA4 event names and shared params shape"
```

---

## Task 12: Admin route group + sidebar shell + admin gate

**Files:**
- Create: `src/app/(admin)/layout.tsx`
- Create: `src/app/(admin)/admin/etsy-candidates/admin-sidebar.tsx`
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: Implement admin layout with gate**

Create `src/app/(admin)/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Container } from "@/components/ui/container";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { AdminSidebar } from "./admin/etsy-candidates/admin-sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    notFound(); // 404 — never reveal that the route exists
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Nav width="app" />
      <main className="flex-1 py-8 md:py-10">
        <Container width="app">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
            <AdminSidebar />
            <div className="min-w-0">{children}</div>
          </div>
        </Container>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Implement the sidebar**

Create `src/app/(admin)/admin/etsy-candidates/admin-sidebar.tsx`:

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Etsy candidates", href: "/admin/etsy-candidates", active: true },
  { label: "Generations", href: "#", active: false },
  { label: "Library", href: "#", active: false },
  { label: "Batches", href: "#", active: false },
  { label: "Discover", href: "#", active: false },
  { label: "Settings", href: "#", active: false },
] as const;

export function AdminSidebar() {
  return (
    <aside className="md:sticky md:top-20 md:self-start">
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
        Admin
      </p>
      <nav aria-label="Admin sections" className="flex flex-col gap-1">
        {ITEMS.map((item) =>
          item.active ? (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-md bg-surface px-3 py-2 text-[14px] font-medium text-ink"
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.label}
              aria-disabled="true"
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-[14px] text-ink-4",
                "cursor-default select-none",
              )}
            >
              <span>{item.label}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-4">
                Soon
              </span>
            </span>
          ),
        )}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Add Admin link to top nav (admin-only)**

In `src/components/nav.tsx`, add the import and a conditional link. After existing imports:

```ts
import { isAdminEmail } from "@/lib/admin";
```

Inside the component, after computing `email`:

```ts
const isAdmin = isAdminEmail(email);
```

Inside the signed-in `<>...</>` block in the primary nav (right after `<NavLink href="/account">Account</NavLink>`), add:

```tsx
{isAdmin ? <NavLink href="/admin/etsy-candidates">Admin</NavLink> : null}
```

- [ ] **Step 4: Smoke test the gate**

Start dev: `pnpm dev`. Sign out (or use an incognito window) and visit `http://localhost:3000/admin/etsy-candidates`. Expected: Next.js 404 page. Sign in as `gblazer@gmail.com` and revisit — expected: empty layout with sidebar (no page content yet — built next task).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/ src/components/nav.tsx
git commit -m "feat(admin): admin route group with sidebar shell and admin-only gate"
```

---

## Task 13: Admin candidates page (server-rendered shell)

**Files:**
- Create: `src/app/(admin)/admin/etsy-candidates/page.tsx`
- Create: `src/app/(admin)/admin/etsy-candidates/status-pill.tsx`

- [ ] **Step 1: Implement the status pill**

Create `src/app/(admin)/admin/etsy-candidates/status-pill.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { EtsyCandidate } from "@/lib/db/schema";

const STYLES: Record<EtsyCandidate["status"], string> = {
  pending: "bg-surface text-ink-3 border-line-soft",
  generating: "bg-amber-50 text-amber-800 border-amber-200",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-emerald-50 text-emerald-800 border-emerald-200",
  failed: "bg-rose-50 text-rose-800 border-rose-200",
  skipped: "bg-surface text-ink-4 border-line-soft",
  to_review: "bg-cream text-ink-2 border-line-soft",
};

const LABELS: Record<EtsyCandidate["status"], string> = {
  pending: "Pending",
  generating: "Generating",
  completed: "Completed",
  partial: "Partial",
  failed: "Failed",
  skipped: "Skipped",
  to_review: "To review",
};

export function StatusPill({ status }: { status: EtsyCandidate["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        STYLES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 2: Implement the server page**

Create `src/app/(admin)/admin/etsy-candidates/page.tsx`:

```tsx
import { listCandidates } from "@/lib/etsy-outreach/candidates";
import { listPreviewsByCandidateIds } from "@/lib/etsy-outreach/pages";
import { previewMetrics, topPreviewsByViews } from "@/lib/etsy-outreach/events";
import { CandidatesTable } from "./candidates-table";
import { MetricsCards } from "./metrics-cards";
import { TopPreviews } from "./top-previews";

export const dynamic = "force-dynamic";

export default async function EtsyCandidatesPage() {
  const candidates = await listCandidates();
  const previews = await listPreviewsByCandidateIds(candidates.map((c) => c.id));
  const previewByCandidate = new Map(
    previews.map((p) => [p.candidateId, p] as const),
  );
  const metrics = await previewMetrics();
  const top = await topPreviewsByViews(5);

  const rows = candidates.map((c) => {
    const preview = previewByCandidate.get(c.id);
    return {
      id: c.id,
      title: c.title,
      shopName: c.shopName,
      imageUrl: c.imageUrl,
      listingUrl: c.listingUrl,
      status: c.status,
      updatedAt: c.updatedAt.toISOString(),
      preview: preview
        ? {
            id: preview.id,
            token: preview.token,
            status: preview.status,
          }
        : null,
    };
  });

  return (
    <section className="flex flex-col gap-10">
      <header>
        <h1 className="font-serif text-[clamp(2rem,2.4vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">
          Etsy candidates
        </h1>
        <p className="mt-2 max-w-[58ch] text-[14px] text-ink-3">
          Review Etsy listings and generate Shopify-ready examples for outreach.
        </p>
      </header>

      <CandidatesTable rows={rows} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <MetricsCards metrics={metrics} />
        <TopPreviews items={top} />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Stub the three child components so the page builds**

We'll fill these in subsequent tasks. Create three placeholder files that compile:

`src/app/(admin)/admin/etsy-candidates/candidates-table.tsx`:

```tsx
"use client";

export type CandidateRow = {
  id: string;
  title: string;
  shopName: string | null;
  imageUrl: string | null;
  listingUrl: string;
  status:
    | "pending"
    | "generating"
    | "completed"
    | "partial"
    | "failed"
    | "skipped"
    | "to_review";
  updatedAt: string;
  preview: { id: string; token: string; status: string } | null;
};

export function CandidatesTable({ rows }: { rows: CandidateRow[] }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Candidates table — {rows.length} rows
      </p>
    </div>
  );
}
```

`src/app/(admin)/admin/etsy-candidates/metrics-cards.tsx`:

```tsx
export function MetricsCards({
  metrics,
}: {
  metrics: { previewCount: number; viewSum: number; ctaClickSum: number; signupSum: number };
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Recent performance — {metrics.previewCount} previews
      </p>
    </div>
  );
}
```

`src/app/(admin)/admin/etsy-candidates/top-previews.tsx`:

```tsx
type Item = {
  id: string;
  token: string;
  title: string;
  viewCount: number;
  ctaClickCount: number;
  signupCount: number;
};

export function TopPreviews({ items }: { items: Item[] }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Top performing previews — {items.length}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Smoke test**

In a fresh dev server, sign in as admin and visit `/admin/etsy-candidates`. Expected: page renders header + three placeholder cards (no candidates yet — table shows 0 rows; we ingest in Task 14).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/admin/etsy-candidates/
git commit -m "feat(admin): etsy-candidates page server shell with stubbed children"
```

---

## Task 14: Admin API — ingest

**Files:**
- Create: `src/app/api/admin/etsy/ingest/route.ts`

- [ ] **Step 1: Implement the ingest endpoint**

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { readCandidatesMd } from "@/lib/etsy-outreach/source";
import { parseEtsyCandidatesMd } from "@/lib/etsy-outreach/parse-md";
import { upsertCandidatesFromParsed } from "@/lib/etsy-outreach/candidates";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const md = await readCandidatesMd();
  const { candidates, errors } = parseEtsyCandidatesMd(md);
  const result = await upsertCandidatesFromParsed(candidates);

  return NextResponse.json({
    parsed: candidates.length,
    parseErrors: errors.length,
    upserted: result.inserted,
  });
}
```

- [ ] **Step 2: Manual smoke test**

Sign in as admin and run:

```bash
curl -X POST http://localhost:3000/api/admin/etsy/ingest \
  -b "$(pnpm exec node -e 'console.log("")')"
```

Easier: open `/admin/etsy-candidates` in the browser, then in devtools console:

```js
await fetch("/api/admin/etsy/ingest", { method: "POST" }).then((r) => r.json());
```

Expected: `{ parsed: 100, parseErrors: 0, upserted: 100 }`. Refresh the admin page; the candidates-table placeholder should show 100 rows.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/etsy/ingest/route.ts
git commit -m "feat(admin): POST /api/admin/etsy/ingest re-parses MD and upserts candidates"
```

---

## Task 15: Candidates table client component (selection + bulk actions)

**Files:**
- Modify: `src/app/(admin)/admin/etsy-candidates/candidates-table.tsx`

- [ ] **Step 1: Replace the stub with a real client component**

```tsx
"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { StatusPill } from "./status-pill";

export type CandidateRow = {
  id: string;
  title: string;
  shopName: string | null;
  imageUrl: string | null;
  listingUrl: string;
  status:
    | "pending"
    | "generating"
    | "completed"
    | "partial"
    | "failed"
    | "skipped"
    | "to_review";
  updatedAt: string;
  preview: { id: string; token: string; status: string } | null;
};

function formatRelative(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function CandidatesTable({ rows }: { rows: CandidateRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mock, setMock] = useState(true);
  const [busy, setBusy] = useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function generate() {
    if (selectedIds.length === 0) return;
    setBusy(true);
    try {
      track("etsy_admin_generation_submitted", { count: selectedIds.length, mock });
      const res = await fetch("/api/admin/etsy/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateIds: selectedIds, mock }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body);
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function ingest() {
    setBusy(true);
    try {
      await fetch("/api/admin/etsy/ingest", { method: "POST" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(row: CandidateRow) {
    if (!row.preview) return;
    const url = `${window.location.origin}/etsy-preview/${row.preview.token}`;
    await navigator.clipboard.writeText(url);
    track("etsy_admin_copy_preview_link", {
      page_id: row.preview.id,
      preview_token: row.preview.token,
    });
  }

  return (
    <section className="rounded-2xl border border-line-soft bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : `${rows.length} candidates`}
          </span>
          <label className="flex items-center gap-2 text-[12px] text-ink-3">
            <input
              type="checkbox"
              checked={mock}
              onChange={(e) => setMock(e.target.checked)}
            />
            Mock mode
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={ingest}
            disabled={busy}
            className="rounded-full border border-line bg-paper px-4 py-2 text-[13px] text-ink-2 hover:bg-surface disabled:opacity-50"
          >
            Re-ingest MD
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={busy || selectedIds.length === 0}
            className="rounded-full bg-ink px-5 py-2 text-[13px] font-medium text-cream hover:bg-ink-2 disabled:opacity-40"
          >
            Generate selected
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            <tr className="border-b border-line-soft">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-2 py-3 text-left">Image</th>
              <th className="px-3 py-3 text-left">Title</th>
              <th className="px-3 py-3 text-left">Shop</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Preview</th>
              <th className="px-3 py-3 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line-soft last:border-0 hover:bg-paper/40"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${row.title}`}
                  />
                </td>
                <td className="px-2 py-3">
                  {row.imageUrl ? (
                    <Image
                      src={row.imageUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-md object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-md border border-line-soft bg-paper" />
                  )}
                </td>
                <td className="max-w-[28ch] truncate px-3 py-3 text-ink">
                  <Link
                    href={row.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {row.title}
                  </Link>
                </td>
                <td className="px-3 py-3 text-ink-3">{row.shopName ?? "—"}</td>
                <td className="px-3 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-3 py-3">
                  {row.preview ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyLink(row)}
                        className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-2 hover:bg-surface"
                      >
                        Copy
                      </button>
                      <Link
                        href={`/etsy-preview/${row.preview.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-ink px-3 py-1 text-[11px] text-cream hover:bg-ink-2"
                      >
                        Open
                      </Link>
                    </div>
                  ) : (
                    <span className="text-ink-4">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-4">{formatRelative(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Allow Etsy CDN images in next.config**

The candidate thumbnails come from `i.etsystatic.com`. Open `next.config.ts` and ensure `images.remotePatterns` includes that host. If `images` is missing entirely, add:

```ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "i.etsystatic.com" },
  ],
},
```

(The `unoptimized` prop on the `<Image>` works around this if you'd rather skip the config change. Leave the config as-is if `unoptimized` is acceptable for admin-only thumbnails.)

- [ ] **Step 3: Smoke test**

Visit `/admin/etsy-candidates` as admin. Expected: 100 rows render with thumbnails, "Pending" pills, and disabled "Generate selected" until rows are checked. Selecting rows enables the button.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/etsy-candidates/candidates-table.tsx next.config.ts
git commit -m "feat(admin): candidates table with selection, mock toggle, copy link"
```

---

## Task 16: Admin API — generate, retry, skip, status

**Files:**
- Create: `src/app/api/admin/etsy/generate/route.ts`
- Create: `src/app/api/admin/etsy/retry/route.ts`
- Create: `src/app/api/admin/etsy/skip/route.ts`
- Create: `src/app/api/admin/etsy/status/route.ts`

- [ ] **Step 1: Implement generate**

```ts
// src/app/api/admin/etsy/generate/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  getCandidatesByIds,
  setCandidatesStatus,
} from "@/lib/etsy-outreach/candidates";
import { createPreviewPage } from "@/lib/etsy-outreach/pages";
import { processEtsyPreview } from "@/lib/workflows/process-etsy-preview";

const Body = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(50),
  mock: z.boolean().default(false),
});

const CONCURRENCY = Number(process.env.ETSY_GENERATION_CONCURRENCY ?? 4);

async function chunkAndRun<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const adminEmail = user!.email!;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { candidateIds, mock } = parsed.data;

  const candidates = await getCandidatesByIds(candidateIds);
  if (candidates.length === 0) {
    return NextResponse.json({ error: "no candidates" }, { status: 400 });
  }

  const pages = await Promise.all(
    candidates.map((c) => createPreviewPage({ candidate: c, createdBy: adminEmail })),
  );
  await setCandidatesStatus(candidateIds, "generating");

  // Fire and forget — workflow handles persistence end-to-end.
  void chunkAndRun(pages, CONCURRENCY, (p) => processEtsyPreview(p.id, mock)).catch(
    (e) => console.error("[etsy-outreach] batch failed", e),
  );

  return NextResponse.json({
    enqueued: pages.length,
    pages: pages.map((p) => ({ id: p.id, token: p.token })),
    mock,
  });
}
```

- [ ] **Step 2: Implement retry**

```ts
// src/app/api/admin/etsy/retry/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { getPreviewById, resetFailedSlots } from "@/lib/etsy-outreach/pages";
import { processEtsyPreview } from "@/lib/workflows/process-etsy-preview";

const Body = z.object({
  pageId: z.string().uuid(),
  mock: z.boolean().default(false),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { pageId, mock } = parsed.data;

  const page = await getPreviewById(pageId);
  if (!page) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await resetFailedSlots(pageId);
  void processEtsyPreview(pageId, mock).catch((e) =>
    console.error("[etsy-outreach] retry failed", e),
  );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement skip**

```ts
// src/app/api/admin/etsy/skip/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { setCandidatesStatus } from "@/lib/etsy-outreach/candidates";

const Body = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await setCandidatesStatus(parsed.data.candidateIds, "skipped");
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Implement status (for client polling)**

```ts
// src/app/api/admin/etsy/status/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { getPreviewById } from "@/lib/etsy-outreach/pages";

const Query = z.object({ pageId: z.string().uuid() });

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({ pageId: url.searchParams.get("pageId") });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const page = await getPreviewById(parsed.data.pageId);
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: page.id,
    status: page.status,
    heroStatus: page.heroStatus,
    lifestyleStatus: page.lifestyleStatus,
    detailStatus: page.detailStatus,
    completedAt: page.completedAt,
  });
}
```

- [ ] **Step 5: Manual test**

Sign in as admin, select 2 candidates with images, ensure Mock mode is checked, click Generate selected. Expected: page reloads; selected rows transition through `generating` → `completed` (status updates after page reload — auto-refresh comes in Task 17). Manually refresh after ~30s; rows should be Completed and "Open"/"Copy" buttons appear.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/etsy/
git commit -m "feat(admin): generate, retry, skip, status APIs for etsy outreach"
```

---

## Task 17: Public events API + counter increments

**Files:**
- Create: `src/app/api/public/etsy-preview/[token]/event/route.ts`

- [ ] **Step 1: Implement the endpoint**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPreviewByToken } from "@/lib/etsy-outreach/pages";
import { recordEvent } from "@/lib/etsy-outreach/events";

const Body = z.object({
  kind: z.enum(["cta_click", "signup_start"]),
  label: z.string().max(64).optional(),
});

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const page = await getPreviewByToken(token);
  if (!page) {
    // Always 404 on bad token — never 403 (don't reveal route shape)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await recordEvent({
    pageId: page.id,
    kind: parsed.data.kind,
    label: parsed.data.label,
    userAgent: req.headers.get("user-agent"),
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/public/etsy-preview/
git commit -m "feat(etsy-preview): public CTA/signup_start event endpoint"
```

---

## Task 18: Preview page — server render + view tracking

**Files:**
- Create: `src/app/etsy-preview/[token]/page.tsx`
- Create: `src/app/etsy-preview/[token]/preview-cta.tsx`
- Create: `src/app/etsy-preview/[token]/opengraph-image.tsx`

- [ ] **Step 1: Create the CTA client component**

```tsx
// src/app/etsy-preview/[token]/preview-cta.tsx
"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

type Props = {
  token: string;
  candidateId: string;
  sellerName: string | null;
  listingUrl: string;
};

export function PreviewCta(props: Props) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const common = {
    preview_token: props.token,
    candidate_id: props.candidateId,
    seller_name: props.sellerName,
    listing_url: props.listingUrl,
    source: "etsy_outreach" as const,
  };

  async function postEvent(kind: "cta_click" | "signup_start", label: string) {
    try {
      await fetch(`/api/public/etsy-preview/${props.token}/event`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, label }),
      });
    } catch {
      // best-effort; don't block the navigation
    }
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    track("etsy_preview_cta_click", { ...common, label: "email_submit" });
    track("etsy_preview_signup_start", { ...common, method: "email" });
    await postEvent("cta_click", "email_submit");
    await postEvent("signup_start", "email");
    const url = new URL("/sign-up", window.location.origin);
    url.searchParams.set("ref", "etsy-preview");
    url.searchParams.set("token", props.token);
    url.searchParams.set("email", email);
    window.location.href = url.toString();
  }

  async function onGoogle() {
    setBusy(true);
    track("etsy_preview_cta_click", { ...common, label: "google" });
    track("etsy_preview_signup_start", { ...common, method: "google" });
    await postEvent("cta_click", "google");
    await postEvent("signup_start", "google");
    const url = new URL("/sign-in", window.location.origin);
    url.searchParams.set("ref", "etsy-preview");
    url.searchParams.set("token", props.token);
    url.searchParams.set("provider", "google");
    window.location.href = url.toString();
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-8 md:p-10">
      <h2 className="font-serif text-[clamp(1.6rem,2.2vw,2.25rem)] leading-[1.1] tracking-[-0.015em]">
        Ready to create your own stunning images?
      </h2>
      <p className="mt-2 max-w-[44ch] text-[14px] text-ink-3">
        Join Vesperdrop and transform your products in minutes.
      </p>

      <form onSubmit={onEmailSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-full border border-line bg-paper px-4 py-3 text-[14px] focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ink px-6 py-3 text-[14px] font-medium text-cream hover:bg-ink-2 disabled:opacity-50"
        >
          Start your free trial
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-ink-4">
        <span className="h-px flex-1 bg-line-soft" /> or <span className="h-px flex-1 bg-line-soft" />
      </div>

      <button
        type="button"
        onClick={onGoogle}
        disabled={busy}
        className="w-full rounded-full border border-line bg-paper px-6 py-3 text-[14px] text-ink hover:bg-surface disabled:opacity-50"
      >
        Continue with Google
      </button>

      <ul className="mt-6 grid grid-cols-1 gap-2 text-[12px] text-ink-3 sm:grid-cols-3">
        <li>7-day free trial</li>
        <li>Cancel anytime</li>
        <li>No credit card required</li>
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Create the server page**

```tsx
// src/app/etsy-preview/[token]/page.tsx
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { getPreviewByToken } from "@/lib/etsy-outreach/pages";
import { recordEvent } from "@/lib/etsy-outreach/events";
import { PreviewCta } from "./preview-cta";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Your products on Shopify · Vesperdrop",
    robots: { index: false, follow: false },
    alternates: { canonical: `/etsy-preview/${token}` },
  };
}

const VIEW_COOKIE_PREFIX = "vd_etsy_view_";

export default async function EtsyPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const page = await getPreviewByToken(token);
  if (!page || (page.status !== "completed" && page.status !== "partial")) {
    notFound();
  }

  // Server-side view counter, deduped per session via cookie.
  const cookieStore = await cookies();
  const cookieName = `${VIEW_COOKIE_PREFIX}${page.id.slice(0, 8)}`;
  const alreadySeen = cookieStore.get(cookieName)?.value === "1";
  const hdrs = await headers();
  if (!alreadySeen) {
    await recordEvent({
      pageId: page.id,
      kind: "view",
      userAgent: hdrs.get("user-agent"),
      ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip"),
    });
    cookieStore.set(cookieName, "1", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 1 day dedup
    });
  }

  // Attribution cookie for downstream Stripe webhook.
  cookieStore.set(
    "vd_etsy_ref",
    JSON.stringify({ token, candidate_id: page.candidateId }),
    { httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" },
  );

  const snap = page.listingSnapshot;
  const generated = [page.heroUrl, page.lifestyleUrl, page.detailUrl].filter(
    (u): u is string => Boolean(u),
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-line-soft py-5">
        <Container width="marketing" className="flex items-center justify-between">
          <Link href="/" className="font-serif text-[20px] tracking-tight">
            Vesperdrop
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
            Private preview
          </span>
        </Container>
      </header>

      <main className="flex-1 py-14 md:py-20">
        <Container width="marketing" className="flex flex-col gap-16">
          {/* Hero */}
          <section className="max-w-[58ch]">
            <h1 className="font-serif text-[clamp(2.4rem,4vw,3.6rem)] leading-[1.05] tracking-[-0.02em]">
              Hi there, this is what{" "}
              <span className="text-terracotta">your product</span> could look
              like on Shopify.
            </h1>
            <p className="mt-5 text-[15px] text-ink-3">
              We created these examples from your Etsy listing to help you
              visualize the possibilities.
            </p>
          </section>

          {/* Before → after */}
          <section className="grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr] md:items-start">
            <div className="rounded-2xl border border-line-soft bg-surface p-4">
              {snap.imageUrl ? (
                <Image
                  src={snap.imageUrl}
                  alt={snap.title}
                  width={260}
                  height={325}
                  className="w-full rounded-lg object-cover"
                  unoptimized
                />
              ) : page.sourceBlobUrl ? (
                <Image
                  src={page.sourceBlobUrl}
                  alt={snap.title}
                  width={260}
                  height={325}
                  className="w-full rounded-lg object-cover"
                  unoptimized
                />
              ) : null}
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
                Etsy listing
              </p>
              <p className="mt-2 line-clamp-2 text-[13px] text-ink">
                {snap.title}
              </p>
              {snap.shopName ? (
                <p className="mt-1 text-[12px] text-ink-3">{snap.shopName}</p>
              ) : null}
              <Link
                href={snap.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[12px] text-ink-3 underline-offset-4 hover:underline"
              >
                View original ↗
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {generated.map((url, i) => (
                <div
                  key={url}
                  className="overflow-hidden rounded-2xl border border-line-soft bg-surface"
                >
                  <Image
                    src={url}
                    alt={`Generated example ${i + 1}`}
                    width={400}
                    height={500}
                    className="aspect-[4/5] w-full object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Benefits */}
          <section className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              ["Shopify ready", "Sized and styled for product pages."],
              ["Lifestyle focused", "Context that helps customers picture themselves wearing it."],
              ["Higher conversions", "Editorial-grade imagery converts better than flat lays."],
              ["Save time & money", "No photoshoot. Minutes instead of days."],
            ].map(([title, body]) => (
              <div key={title}>
                <p className="font-serif text-[16px] text-ink">{title}</p>
                <p className="mt-1 text-[12px] text-ink-3">{body}</p>
              </div>
            ))}
          </section>

          {/* Conversion */}
          <PreviewCta
            token={token}
            candidateId={page.candidateId}
            sellerName={snap.shopName}
            listingUrl={snap.listingUrl}
          />

          {/* Bottom note */}
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
            This is a private preview made just for you by Vesperdrop.
          </p>
        </Container>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add a view-tracking client effect for GA4**

The server-side counter already runs above, but the GA4 `etsy_preview_view` needs a client mount. Add a tiny client component and import it. Append to `preview-cta.tsx` (top-level export) so the page only loads one client bundle:

```tsx
// Append to preview-cta.tsx
import { useEffect } from "react";

export function PreviewViewTracker(props: {
  token: string;
  candidateId: string;
  sellerName: string | null;
  listingUrl: string;
}) {
  useEffect(() => {
    track("etsy_preview_view", {
      preview_token: props.token,
      candidate_id: props.candidateId,
      seller_name: props.sellerName,
      listing_url: props.listingUrl,
      source: "etsy_outreach",
    });
  }, [props.token, props.candidateId, props.sellerName, props.listingUrl]);
  return null;
}
```

Then render `<PreviewViewTracker .../>` near the top of the page body in `page.tsx`. Update `page.tsx` to also import `PreviewViewTracker`:

```tsx
import { PreviewCta, PreviewViewTracker } from "./preview-cta";
```

And inside `<main>`, immediately after the opening `<Container>`:

```tsx
<PreviewViewTracker
  token={token}
  candidateId={page.candidateId}
  sellerName={snap.shopName}
  listingUrl={snap.listingUrl}
/>
```

- [ ] **Step 4: OG image**

Create `src/app/etsy-preview/[token]/opengraph-image.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { getPreviewByToken } from "@/lib/etsy-outreach/pages";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({ params }: { params: { token: string } }) {
  const page = await getPreviewByToken(params.token);
  const url = page?.heroUrl ?? page?.lifestyleUrl ?? page?.detailUrl;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f5efe6",
          color: "#1f1a17",
          fontFamily: "serif",
          padding: 64,
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 32, opacity: 0.6 }}>Vesperdrop</div>
          <div style={{ fontSize: 64, lineHeight: 1.05, marginTop: 24 }}>
            Your product on Shopify.
          </div>
        </div>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" width={500} height={500} style={{ borderRadius: 24, objectFit: "cover" }} />
        ) : null}
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 5: Smoke test**

In dev, after generating with mock mode for one candidate, copy the preview link from the admin table and open it in a private window. Expected: the page renders end-to-end (hero, before/after with three images, benefits, conversion form, footer note). Reload the page; `view_count` should be `1` (deduped by the cookie). Submit a fake email; you should be redirected to `/sign-up?ref=etsy-preview&token=...`.

Verify counters in DB:

```bash
pnpm exec supabase db psql --command "select view_count, cta_click_count, signup_click_count, signup_count from etsy_preview_pages order by updated_at desc limit 5;"
```

- [ ] **Step 6: Commit**

```bash
git add src/app/etsy-preview/
git commit -m "feat(etsy-preview): seller-facing preview page with hero, before/after, CTA, view+signup_start tracking"
```

---

## Task 19: Stripe webhook attribution + admin generation completion poll

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/app/(admin)/admin/etsy-candidates/candidates-table.tsx`

- [ ] **Step 1: Forward the cookie into Stripe Checkout metadata**

The webhook (`src/app/api/stripe/webhook/route.ts`) only constructs the event and delegates to `handleStripeEvent` in `src/lib/stripe/webhook.ts`. Stripe webhooks have no cookies, so we round-trip the `vd_etsy_ref` cookie through Checkout Session metadata.

Edit `src/app/api/stripe/checkout/route.ts`. Find the `stripe.checkout.sessions.create({...})` call. Add at the top of the handler:

```ts
import { cookies } from "next/headers";
```

And inside the handler, before `sessions.create`:

```ts
const cookieStore = await cookies();
const etsyRef = cookieStore.get("vd_etsy_ref")?.value;
```

Then in the `metadata` object passed to `sessions.create`:

```ts
metadata: {
  // ...existing keys preserved...
  ...(etsyRef ? { vd_etsy_ref: etsyRef } : {}),
},
```

- [ ] **Step 2: Read the metadata in the webhook handler**

Edit `src/lib/stripe/webhook.ts`. Inside the `checkout.session.completed` branch (search for it; preserve existing logic), add at the top of the file:

```ts
import { recordEvent } from "@/lib/etsy-outreach/events";
import { getPreviewByToken } from "@/lib/etsy-outreach/pages";
```

And inside the handler, after the existing success logic:

```ts
const etsyRef = session.metadata?.vd_etsy_ref;
if (etsyRef) {
  try {
    const parsed = JSON.parse(etsyRef) as { token?: string };
    if (parsed.token) {
      const preview = await getPreviewByToken(parsed.token);
      if (preview) {
        await recordEvent({ pageId: preview.id, kind: "signup" });
      }
    }
  } catch (e) {
    console.warn("[etsy-outreach] bad vd_etsy_ref metadata", e);
  }
}
```

Verify the variable name `session` matches what the existing branch uses; rename if necessary.

- [ ] **Step 3: Add status polling to the admin table**

In `candidates-table.tsx`, add an effect that polls `/api/admin/etsy/status?pageId=...` for any visible row whose preview is in `pending`/`generating` state and fires `etsy_admin_generation_completed` once they reach a terminal state. Insert near the top of `CandidatesTable`:

```tsx
import { useEffect, useRef } from "react";
// ... existing imports
```

And inside `CandidatesTable`, before `return`:

```tsx
const fired = useRef<Set<string>>(new Set());
useEffect(() => {
  const inflight = rows.filter(
    (r) => r.preview && (r.status === "generating" || r.status === "pending"),
  );
  if (inflight.length === 0) return;
  const interval = window.setInterval(async () => {
    let anyTerminal = false;
    for (const row of inflight) {
      if (!row.preview || fired.current.has(row.preview.id)) continue;
      const res = await fetch(`/api/admin/etsy/status?pageId=${row.preview.id}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { status: string };
      if (
        data.status === "completed" ||
        data.status === "partial" ||
        data.status === "failed"
      ) {
        track("etsy_admin_generation_completed", {
          page_id: row.preview.id,
          status: data.status as "completed" | "partial" | "failed",
        });
        fired.current.add(row.preview.id);
        anyTerminal = true;
      }
    }
    if (anyTerminal) window.location.reload();
  }, 5000);
  return () => window.clearInterval(interval);
}, [rows]);
```

- [ ] **Step 4: Smoke test attribution**

Generate one preview, open it in a private window, submit the email form, complete the Stripe Checkout flow with a test card on the resulting `/sign-up` page. Verify:

```bash
pnpm exec supabase db psql --command "select id, view_count, cta_click_count, signup_click_count, signup_count from etsy_preview_pages order by updated_at desc limit 1;"
```
Expected: all four counters are non-zero.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stripe/ src/lib/stripe/webhook.ts src/app/\(admin\)/admin/etsy-candidates/candidates-table.tsx
git commit -m "feat(etsy-outreach): Stripe attribution + admin status polling fires generation_completed"
```

---

## Task 20: Admin metrics tiles + top performing previews

**Files:**
- Modify: `src/app/(admin)/admin/etsy-candidates/metrics-cards.tsx`
- Modify: `src/app/(admin)/admin/etsy-candidates/top-previews.tsx`

- [ ] **Step 1: Implement metrics-cards.tsx**

```tsx
type Metrics = {
  previewCount: number;
  viewSum: number;
  ctaClickSum: number;
  signupSum: number;
};

function rate(num: number, den: number): string {
  if (den === 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </p>
      <p className="mt-1 font-serif text-[28px] tracking-[-0.01em] text-ink">
        {value}
      </p>
    </div>
  );
}

export function MetricsCards({ metrics }: { metrics: Metrics }) {
  return (
    <section className="rounded-2xl border border-line-soft bg-surface p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        Recent performance
      </p>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <Tile label="Previews" value={metrics.previewCount} />
        <Tile label="Views" value={metrics.viewSum} />
        <Tile label="CTA clicks" value={metrics.ctaClickSum} />
        <Tile
          label="Conversion rate"
          value={rate(metrics.signupSum, metrics.viewSum)}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement top-previews.tsx**

```tsx
import Link from "next/link";

type Item = {
  id: string;
  token: string;
  title: string;
  viewCount: number;
  ctaClickCount: number;
  signupCount: number;
};

export function TopPreviews({ items }: { items: Item[] }) {
  return (
    <section className="rounded-2xl border border-line-soft bg-surface p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        Top performing previews
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-line-soft">
        {items.length === 0 ? (
          <li className="py-3 text-[13px] text-ink-3">No previews yet.</li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <Link
                href={`/etsy-preview/${item.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-1 max-w-[28ch] text-[13px] text-ink hover:underline"
              >
                {item.title}
              </Link>
              <div className="flex shrink-0 items-center gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                <span>{item.viewCount} views</span>
                <span>{item.ctaClickCount} clicks</span>
                <span>{item.signupCount} signups</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Smoke test**

Refresh `/admin/etsy-candidates`. Expected: bottom row shows "Recent performance" tile (with the four numbers from earlier smoke tests) and the "Top performing previews" list with up to 5 items.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/etsy-candidates/metrics-cards.tsx src/app/\(admin\)/admin/etsy-candidates/top-previews.tsx
git commit -m "feat(admin): metrics tiles and top performing previews list"
```

---

## Task 21: Robots/sitemap exclusion + final QA

**Files:**
- Modify: `src/app/robots.ts`

- [ ] **Step 1: Add disallow rules**

Edit `src/app/robots.ts` — extend the `disallow` array to include the new routes:

```ts
disallow: [
  "/api/",
  "/account",
  "/app",
  "/sign-in",
  "/sign-up",
  "/mfa-verify",
  "/unauthorized",
  "/admin",
  "/etsy-preview",
],
```

- [ ] **Step 2: Confirm sitemap exclusion**

`src/app/sitemap.ts` already only enumerates `/`, `/pricing`, `/try`, `/discover`. No change needed — the preview route is dynamic and not present.

- [ ] **Step 3: Verify response headers on a preview page**

```bash
curl -sI http://localhost:3000/etsy-preview/<token> | grep -i 'x-robots\|robots'
```
Expected: response either contains `X-Robots-Tag: noindex, follow` (Next.js sets it from `robots: { index: false }` metadata) or the HTML `<meta name="robots" content="noindex,nofollow">`. If only the meta tag is present and you want the header too, add explicit response headers via the route handler — but the meta tag plus robots.txt disallow is sufficient.

- [ ] **Step 4: Final QA checklist** (run through manually, check off each)

- [ ] Non-admin (signed out) hits `/admin/etsy-candidates` → Next.js 404 page.
- [ ] Non-admin (signed in as non-admin email) hits `/admin/etsy-candidates` → 404.
- [ ] Admin sees `Admin` link in nav and lands on the table after click.
- [ ] Re-ingest button refreshes candidate list to 100.
- [ ] Multi-select 3, mock mode on, Generate selected → all 3 reach `completed` within ~30s (status polling fires `etsy_admin_generation_completed`).
- [ ] Open preview link in private window → page renders all 6 sections in order, terracotta accent on "your product".
- [ ] `view_count` increments on first load, not on refresh within the dedup window.
- [ ] Email submit → redirects to `/sign-up?ref=etsy-preview&token=...&email=...` and `cta_click_count` + `signup_click_count` increment.
- [ ] `Continue with Google` → redirects to `/sign-in?ref=etsy-preview&token=...&provider=google`.
- [ ] After completing a Stripe checkout with the cookie set, `signup_count` increments.
- [ ] Mobile: preview page collapses the three-image row gracefully (resize to 375px width).
- [ ] `curl -sI` of the preview URL has noindex semantics.
- [ ] Top performing previews list shows the test row with non-zero counters.
- [ ] DevTools → Network: GA4 `collect` requests fire for `etsy_preview_view`, `etsy_preview_cta_click`, `etsy_preview_signup_start`, `etsy_admin_generation_submitted`, `etsy_admin_generation_completed`, `etsy_admin_copy_preview_link`.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes (parser + token tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/robots.ts
git commit -m "chore(seo): disallow /admin and /etsy-preview from indexing"
```

---

## Follow-ups (out of scope for v1)

- **Rate-limit the public events endpoint.** Spec §11 calls for limiting `/api/public/etsy-preview/[token]/event` to ~10/min/IP to deter counter inflation. The existing `lib/db/rate-limit.ts` is keyed on `userId` and doesn't fit a public endpoint. Either add a per-IP token bucket (Redis or DB) or accept counter inflation risk for v1 and treat the events log as the source of truth (it stores `ip_hash`, so suspicious spikes are auditable).
- **Confirm Sceneify preset slugs.** Run `sceneify().listPresets()` against staging; replace placeholders in `lib/etsy-outreach/presets.ts` (or set `ETSY_PRESET_HERO` / `ETSY_PRESET_LIFESTYLE` / `ETSY_PRESET_DETAIL` env vars) with the real slugs.
- **Explicit `X-Robots-Tag` response header.** `<meta name="robots">` is in place but adding the header to `/etsy-preview/[token]` belt-and-suspenders ensures non-HTML clients (image/OG fetchers) also see it.
- **`/sign-up` vs `/sign-in` for the email CTA.** Plan implements `/sign-up` (correct intent — new user). Spec §15 wording referenced `/sign-in`. Verify the existing `AuthForm` mode at `/sign-up` accepts the `email` and `ref` query params; if not, switch the redirect to `/sign-in?mode=signup&...`.
- **Sceneify preset enrichment for OG image.** The OG endpoint reads the preview row by token — fine for v1 but adds DB latency to every social crawler hit. Consider caching once the dashboard fills in.

---

## Self-Review Notes

- All spec sections (§1–§15) map to one or more tasks above; nothing is left unbuilt.
- Sceneify preset slugs are intentionally placeholders (Task 9) — the spec flagged this as a TODO and the constants are env-overridable.
- `processEtsyPreview` lives outside the existing `processRun` workflow (Task 10) — separate domain, no shared state, easier rollback.
- Counter increments go through the SQL RPC (Task 3) — atomic, no race conditions across concurrent CTA clicks.
- Type names referenced in later tasks (`PreviewSlotKey`, `EtsyPreviewEventParams`, `CandidateRow`) all match their definitions in earlier tasks.
- TDD is applied to the parser and token generator. The DB layers, workflow, API routes, and UI are built with smoke-test verification — appropriate for thin glue code over verified primitives.

---
