# Pricing v2 — Agent D: Contact Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to work through this plan task-by-task.

**Goal:** Ship a `/contact` page + `POST /api/contact` route that captures inbound sales leads from the Agency CTA, the custom-plans callout, and any other "talk to us" surface. Form submissions are posted to a Slack webhook. No email pipeline in v1.

**Architecture:** Server-rendered marketing page hosts a single client form component. The route handler validates with Zod, rate-limits per IP via the existing `rate_limit_rpc`, posts to `CONTACT_SLACK_WEBHOOK_URL`, and returns a 200 with `{ ok: true }`. Honeypot field protects against the simplest bots. Source query param (`?source=pricing-agency`) is propagated into the Slack message.

**Tech Stack:** Next.js App Router, React 19, Tailwind 4, Zod, Supabase RPC for rate limiting.

**Owned files:**
- `src/app/(marketing)/contact/page.tsx` (new)
- `src/app/api/contact/route.ts` (new)
- `src/components/marketing/contact-form.tsx` (new)
- `src/lib/contact/slack.ts` (new — Slack webhook poster)
- `src/lib/contact/slack.test.ts` (new)

**Forbidden files:** anything Stripe, schema, plans.ts (other than reading).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/(marketing)/contact/page.tsx` | Create | SSR page hosting `<ContactForm>` and copy |
| `src/components/marketing/contact-form.tsx` | Create | Client form, optimistic submit state |
| `src/app/api/contact/route.ts` | Create | POST handler: validate, rate-limit, post to Slack |
| `src/lib/contact/slack.ts` | Create | `postContactToSlack(payload)` helper |
| `src/lib/contact/slack.test.ts` | Create | Unit test for the helper |

---

## Task D1: Slack webhook helper (TDD)

**Files:**
- Create: `src/lib/contact/slack.test.ts`
- Create: `src/lib/contact/slack.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { postContactToSlack } from "./slack";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("@/lib/env", () => ({
  env: { CONTACT_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/X" },
}));

describe("postContactToSlack", () => {
  beforeEach(() => fetchMock.mockReset());

  it("posts a formatted message to the webhook URL", async () => {
    fetchMock.mockResolvedValue({ ok: true } as Response);
    await postContactToSlack({
      name: "Ada",
      email: "ada@example.com",
      company: "Difference Engines",
      monthlyVolume: "1500-5000",
      message: "We make typewriters.",
      source: "pricing-agency",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T/B/X",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Ada"),
      }),
    );
  });

  it("throws when webhook URL is not configured", async () => {
    vi.doMock("@/lib/env", () => ({ env: { CONTACT_SLACK_WEBHOOK_URL: undefined } }));
    vi.resetModules();
    const { postContactToSlack: fresh } = await import("./slack");
    await expect(
      fresh({ name: "A", email: "a@b.co", company: "C", monthlyVolume: "<500", message: null, source: "pricing-custom" }),
    ).rejects.toThrow(/CONTACT_SLACK_WEBHOOK_URL/);
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**
```bash
pnpm test src/lib/contact/slack.test.ts
```

- [ ] **Step 3: Write the implementation**

```ts
import "server-only";
import { env } from "@/lib/env";

export interface ContactPayload {
  name: string;
  email: string;
  company: string;
  monthlyVolume: "<500" | "500-1500" | "1500-5000" | "5000+";
  message: string | null;
  source: string;
}

export async function postContactToSlack(payload: ContactPayload): Promise<void> {
  const url = env.CONTACT_SLACK_WEBHOOK_URL;
  if (!url) {
    throw new Error("CONTACT_SLACK_WEBHOOK_URL is not configured");
  }
  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: `*New contact request* — source: \`${payload.source}\`` } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Name*\n${payload.name}` },
        { type: "mrkdwn", text: `*Email*\n${payload.email}` },
        { type: "mrkdwn", text: `*Company*\n${payload.company}` },
        { type: "mrkdwn", text: `*Monthly volume*\n${payload.monthlyVolume}` },
      ],
    },
  ];
  if (payload.message) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Message*\n${payload.message}` } });
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status}`);
  }
}
```

- [ ] **Step 4: Tests green**
```bash
pnpm test src/lib/contact/slack.test.ts
```

- [ ] **Step 5: Commit**
```bash
git add src/lib/contact/slack.ts src/lib/contact/slack.test.ts
git commit -m "feat(contact): slack webhook helper"
```

---

## Task D2: Route handler

**Files:**
- Create: `src/app/api/contact/route.ts`

- [ ] **Step 1: Write the handler**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { postContactToSlack } from "@/lib/contact/slack";

export const dynamic = "force-dynamic";

const PayloadSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  company: z.string().min(1).max(160),
  monthlyVolume: z.enum(["<500", "500-1500", "1500-5000", "5000+"]),
  message: z.string().max(2000).nullable().optional(),
  source: z.string().max(64).default("contact-direct"),
  // Honeypot — clients leave this empty. Bots fill it.
  website: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  // Honeypot trip: pretend success so the bot doesn't retry.
  if ("website" in parsed.data && parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Rate limit: 3 per hour per IP. Uses existing rate_limit_rpc.
  const { data: allowed, error: rlErr } = await supabaseAdmin.rpc("rate_limit_check", {
    p_bucket: `contact:${ip}`,
    p_limit: 3,
    p_window_seconds: 3600,
  });
  if (rlErr) {
    console.error("[contact] rate limit rpc failed", rlErr);
  } else if (allowed === false) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    await postContactToSlack({
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company,
      monthlyVolume: parsed.data.monthlyVolume,
      message: parsed.data.message ?? null,
      source: parsed.data.source ?? "contact-direct",
    });
  } catch (err) {
    console.error("[contact] slack post failed", err);
    return NextResponse.json({ error: "delivery_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
```

If `rate_limit_check` is named differently in the codebase, inspect `supabase/migrations/20260425000004_rate_limit_rpc.sql` and align the call.

- [ ] **Step 2: Commit**
```bash
git add src/app/api/contact/route.ts
git commit -m "feat(contact): POST /api/contact with validation + rate limit"
```

---

## Task D3: Client form

**Files:**
- Create: `src/components/marketing/contact-form.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

const VOLUMES = ["<500", "500-1500", "1500-5000", "5000+"] as const;

export function ContactForm() {
  const params = useSearchParams();
  const source = params.get("source") ?? "contact-direct";
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      company: String(fd.get("company") ?? ""),
      monthlyVolume: String(fd.get("monthlyVolume") ?? "<500"),
      message: String(fd.get("message") ?? "") || null,
      source,
      website: String(fd.get("website") ?? ""), // honeypot
    };
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setStatus("ok");
    } else if (res.status === 429) {
      setStatus("error");
      setError("Too many submissions. Try again in an hour.");
    } else {
      setStatus("error");
      setError("Something went wrong. Email hello@vesperdrop.com instead.");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-xl border border-line bg-paper-soft p-8 text-center">
        <p className="font-serif text-[28px] leading-tight text-ink">Thanks, we'll be in touch.</p>
        <p className="mt-3 text-[14px] text-ink-3">
          We read every message. Expect a reply within one business day.
        </p>
        <a
          href="/pricing"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
        >
          Back to pricing
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5">
      <Field label="Name" name="name" required />
      <Field label="Email" name="email" type="email" required />
      <Field label="Company or brand" name="company" required />
      <div>
        <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          Monthly photo volume
        </label>
        <select
          name="monthlyVolume"
          required
          className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] text-ink"
        >
          {VOLUMES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          Anything else (optional)
        </label>
        <textarea
          name="message"
          rows={4}
          maxLength={2000}
          className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] text-ink"
        />
      </div>
      {/* Honeypot — visually hidden, must stay empty */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      {error && <p className="text-[13px] text-terracotta-dark">{error}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2 disabled:opacity-60"
      >
        {status === "submitting" ? "Sending..." : "Send"}
      </button>
    </form>
  );
}

function Field({
  label, name, type = "text", required = false,
}: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] text-ink"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/marketing/contact-form.tsx
git commit -m "feat(contact): client form with honeypot + source tracking"
```

---

## Task D4: Page

**Files:**
- Create: `src/app/(marketing)/contact/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { ContactForm } from "@/components/marketing/contact-form";

const TITLE = "Contact, talk to us about a custom plan";
const DESCRIPTION = "Custom plans for big brands, agencies, and high volume sellers. We reply within one business day.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · Vesperdrop` },
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
};

export default function Page() {
  return (
    <Container width="reading" className="pb-24 pt-20 md:pt-28">
      <header className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Contact</p>
        <h1 className="mt-5 font-serif text-[clamp(2.5rem,5vw,3.75rem)] leading-[0.98] tracking-[-0.02em] text-ink">
          Tell us what you need.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.6] text-ink-3">
          Custom plans, API access, team seats, white label. We reply within one business day.
        </p>
      </header>
      <div className="mx-auto mt-12 max-w-xl">
        <Suspense fallback={null}>
          <ContactForm />
        </Suspense>
      </div>
    </Container>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/app/(marketing)/contact/page.tsx
git commit -m "feat(contact): /contact page"
```

---

## Self-Review

- ✅ All four entry sources (`pricing-agency`, `pricing-custom`, `pricing-starter` etc, `contact-direct`) flow through the same form with `source` propagation.
- ✅ Rate-limited per IP via existing RPC (no new infra).
- ✅ Honeypot keeps the dumbest spam out without Turnstile.
- ✅ Success state is inline, no redirect.
- ✅ No edits to Stripe, schema, or plans.ts (other than imports — none needed here).
- ⚠️ Open: confirm `rate_limit_check` is the correct RPC name. Phase 3 catches this if it's wrong.
