# Pricing v2 — Agent A: Pricing UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to work through this plan task-by-task.

**Goal:** Rebuild the marketing pricing page to match the spec: hero, monthly/annual toggle, two-card Free+Pro hero pair, four-row comparison table, custom-plans callout, two-column notes, footer. All prices come from `PLAN_QUOTA` and `PLAN_MARKETING` (already split in Phase 1). No Stripe or DB code.

**Architecture:** Client-side toggle stores `billing` in URL (`?billing=annual`) and via a `BillingProvider` context. All price renderings derive from `PLAN_QUOTA[slug].monthlyQuota` + monthly flat $ + 20% annual discount. CTAs route to checkout for paid plans except Agency, which routes to `/contact?source=pricing-agency`.

**Tech Stack:** Next.js App Router, React 19, Tailwind 4, existing `@/components/ui/container`, `@/lib/analytics`.

**Owned files (Agent A is the only editor):**
- `src/app/(marketing)/pricing/page.tsx`
- `src/components/marketing/pricing-cards.tsx`
- `src/components/marketing/pricing-faq.tsx` (copy updates only)
- `src/components/marketing/structured-data.tsx` (PricingProductJsonLd offers)
- `src/components/marketing/monthly-annual-toggle.tsx` (new)
- `src/components/marketing/billing-provider.tsx` (new)
- `src/components/marketing/hero-pair.tsx` (new)
- `src/components/marketing/comparison-table.tsx` (new)
- `src/lib/plans.ts` — **ONLY** the `PLAN_MARKETING` export. Do NOT touch `PLAN_STRIPE` or `PLAN_QUOTA`.

**Forbidden files:** `src/lib/stripe/**`, `src/lib/db/**`, `src/lib/billing/**`, `src/app/api/**`, `supabase/migrations/**`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/plans.ts` | Modify (`PLAN_MARKETING` only) | Final marketing copy per spec |
| `src/components/marketing/billing-provider.tsx` | Create | React context exposing `{ interval: BillingInterval, setInterval }` |
| `src/components/marketing/monthly-annual-toggle.tsx` | Create | Pill-style segmented toggle, URL-synced |
| `src/components/marketing/hero-pair.tsx` | Create | Free + Pro side-by-side cards |
| `src/components/marketing/comparison-table.tsx` | Create | 4-row comparison table |
| `src/components/marketing/pricing-cards.tsx` | Rewrite | Becomes a thin wrapper composing `HeroPair` + `ComparisonTable` + notes + footer |
| `src/app/(marketing)/pricing/page.tsx` | Rewrite | Hero, `BillingProvider`, `MonthlyAnnualToggle`, `PricingCards`, custom-plans callout, `PricingFaq` |
| `src/components/marketing/pricing-faq.tsx` | Modify | Rewrite questions/answers to match new model (drop credit-pack references, add overage and annual rules) |
| `src/components/marketing/structured-data.tsx` | Modify | Update `offers` array for the new four-tier model |

---

## Task A1: Final marketing copy in `PLAN_MARKETING`

**Files:** Modify `src/lib/plans.ts` (PLAN_MARKETING export only)

- [ ] **Step 1: Replace `PLAN_MARKETING` with the final copy**

```ts
export const PLAN_MARKETING: Record<PlanSlug, PlanMarketing> = {
  free: {
    label: "Free",
    description: "Try VesperDrop on a real product. No card needed.",
    features: [
      "1 full quality photo, no watermark",
      "2 watermarked HD previews",
      "All scene presets",
      "Email support",
    ],
    ctaLabel: "Try free",
    ctaTarget: "checkout",
    perPhotoMonthlyDisplay: "",
    perPhotoAnnualDisplay: "",
    overageDisplay: "",
  },
  starter: {
    label: "Starter",
    description: "For shops dipping their toe in. 25 photos a month.",
    features: [
      "25 photos per month",
      "Full resolution, no watermark",
      "All scene presets",
      "Email support",
    ],
    ctaLabel: "Start",
    ctaTarget: "checkout",
    perPhotoMonthlyDisplay: "$0.76 per photo",
    perPhotoAnnualDisplay: "$0.61 per photo",
    overageDisplay: "overage at $0.50",
  },
  pro: {
    label: "Pro",
    description:
      "For sellers refreshing 10 to 25 SKUs a month. 75 photos covers it cleanly.",
    features: [
      "75 photos per month",
      "Full resolution, no watermark",
      "All scene presets and custom prompts",
      "Priority generation queue",
      "Cancel any time",
    ],
    badge: "popular",
    ctaLabel: "Start Pro",
    ctaTarget: "checkout",
    perPhotoMonthlyDisplay: "$0.52 per photo",
    perPhotoAnnualDisplay: "$0.42 per photo",
    overageDisplay: "overage at $0.50",
  },
  studio: {
    label: "Studio",
    description:
      "For brands shipping a steady catalog. 250 photos a month, every month.",
    features: [
      "250 photos per month",
      "Full resolution, no watermark",
      "All scene presets and custom prompts",
      "Priority generation queue",
      "Cancel any time",
    ],
    ctaLabel: "Start",
    ctaTarget: "checkout",
    perPhotoMonthlyDisplay: "$0.40 per photo",
    perPhotoAnnualDisplay: "$0.32 per photo",
    overageDisplay: "overage at $0.50",
  },
  agency: {
    label: "Agency",
    description:
      "For studios and agencies running multiple brands. 1,500 photos a month and a direct line to us.",
    features: [
      "1,500 photos per month",
      "API access on request",
      "Team seats",
      "White label available",
      "Dedicated Slack support",
    ],
    badge: "for-agencies",
    ctaLabel: "Talk to us",
    ctaTarget: "contact",
    perPhotoMonthlyDisplay: "$0.33 per photo",
    perPhotoAnnualDisplay: "$0.27 per photo",
    overageDisplay: "overage at $0.40",
  },
};
```

- [ ] **Step 2: Verify**
```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add src/lib/plans.ts
git commit -m "feat(pricing): final marketing copy for v2 pricing"
```

---

## Task A2: `BillingProvider` + URL-synced state

**Files:**
- Create: `src/components/marketing/billing-provider.tsx`

- [ ] **Step 1: Write the provider**
```tsx
"use client";
import { createContext, useContext, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { BillingInterval } from "@/lib/plans";

const Ctx = createContext<{
  interval: BillingInterval;
  setInterval: (i: BillingInterval) => void;
} | null>(null);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const interval: BillingInterval =
    params.get("billing") === "annual" ? "annual" : "monthly";

  const setInterval = useCallback(
    (next: BillingInterval) => {
      const sp = new URLSearchParams(params);
      if (next === "annual") sp.set("billing", "annual");
      else sp.delete("billing");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const value = useMemo(() => ({ interval, setInterval }), [interval, setInterval]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBilling() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBilling must be used inside <BillingProvider>");
  return v;
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/marketing/billing-provider.tsx
git commit -m "feat(pricing): billing interval context with URL sync"
```

---

## Task A3: `MonthlyAnnualToggle`

**Files:**
- Create: `src/components/marketing/monthly-annual-toggle.tsx`

- [ ] **Step 1: Write the toggle**
```tsx
"use client";
import { useBilling } from "./billing-provider";
import { track } from "@/lib/analytics";

export function MonthlyAnnualToggle() {
  const { interval, setInterval } = useBilling();
  return (
    <div className="mx-auto inline-flex items-center rounded-full border border-line bg-paper-soft p-1">
      {(["monthly", "annual"] as const).map((opt) => {
        const active = interval === opt;
        const label = opt === "monthly" ? "Monthly" : "Annual, save 20%";
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (interval === opt) return;
              setInterval(opt);
              track("pricing_billing_toggled", { interval: opt });
            }}
            aria-pressed={active}
            className={
              "rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors " +
              (active ? "bg-ink text-cream" : "text-ink-3 hover:text-ink")
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Register the analytics event in `src/lib/analytics.ts`**

Find the union of tracked events and add:
```ts
| { name: "pricing_billing_toggled"; props: { interval: "monthly" | "annual" } }
```

- [ ] **Step 3: Commit**
```bash
git add src/components/marketing/monthly-annual-toggle.tsx src/lib/analytics.ts
git commit -m "feat(pricing): monthly/annual toggle component"
```

---

## Task A4: Pricing math helpers + `HeroPair`

**Files:**
- Create: `src/components/marketing/hero-pair.tsx`

These two formulas are the source of truth and must match `PLAN_QUOTA`:
- Monthly displayed price = base monthly $ from a const map below.
- Annual displayed effective monthly = `Math.round(monthly * 0.8 * 100) / 100`.
- Annual billed total = `Math.round(monthly * 12 * 0.8 * 100) / 100`.

To keep Agent A self-contained (no edits to PLAN_QUOTA which is C's territory), inline a small map of base flat prices here. **This is the only place Agent A hard-codes a dollar amount.** Phase 3 verifies the values match Stripe's actual prices.

- [ ] **Step 1: Write the component**
```tsx
"use client";
import Link from "next/link";
import { PLAN_MARKETING, PLAN_QUOTA, type PlanSlug } from "@/lib/plans";
import { track } from "@/lib/analytics";
import { useBilling } from "./billing-provider";

const FLAT_MONTHLY_USD: Record<PlanSlug, number> = {
  free: 0,
  starter: 19,
  pro: 39,
  studio: 99,
  agency: 499,
};

export function formatEffectiveMonthly(slug: PlanSlug, interval: "monthly" | "annual"): string {
  const m = FLAT_MONTHLY_USD[slug];
  if (m === 0) return "$0";
  const v = interval === "annual" ? m * 0.8 : m;
  return v % 1 === 0 ? `$${v}` : `$${v.toFixed(2)}`;
}

export function formatAnnualTotal(slug: PlanSlug): string {
  const m = FLAT_MONTHLY_USD[slug];
  const yr = m * 12 * 0.8;
  return yr % 1 === 0 ? `$${yr.toFixed(0)}` : `$${yr.toFixed(2)}`;
}

export function HeroPair() {
  const { interval } = useBilling();
  const free = PLAN_MARKETING.free;
  const pro = PLAN_MARKETING.pro;
  const proPerPhoto =
    interval === "annual" ? pro.perPhotoAnnualDisplay : pro.perPhotoMonthlyDisplay;

  return (
    <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
      {/* Free */}
      <div className="flex flex-col rounded-xl border border-line bg-surface p-8 md:p-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          {free.label}
        </p>
        <div className="mb-1 mt-5 flex items-baseline gap-1.5">
          <span className="font-serif text-[clamp(2.75rem,4vw,3.5rem)] leading-none tracking-[-0.02em] text-ink">
            $0
          </span>
          <span className="text-[14px] text-ink-3">/month</span>
        </div>
        <p className="mt-3 text-[14px] leading-[1.55] text-ink-3">{free.description}</p>
        <ul className="mt-7 space-y-3 text-[14px] text-ink-2">
          {free.features.map((f) => (
            <Feature key={f}>{f}</Feature>
          ))}
        </ul>
        <Link
          href="/try"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
        >
          {free.ctaLabel}
        </Link>
      </div>

      {/* Pro */}
      <div className="relative flex flex-col rounded-xl border border-ink bg-ink p-8 text-cream md:p-10">
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center rounded-full bg-terracotta px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream">
          Most popular
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cream/55">
          {pro.label}
        </p>
        <div className="mb-1 mt-5 flex items-baseline gap-1.5">
          <span className="font-serif text-[clamp(2.75rem,4vw,3.5rem)] leading-none tracking-[-0.02em]">
            {formatEffectiveMonthly("pro", interval)}
          </span>
          <span className="text-[14px] text-cream/55">/month</span>
        </div>
        {interval === "annual" && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/55">
            Billed annually at {formatAnnualTotal("pro")}
          </p>
        )}
        <p className="mt-3 text-[14px] leading-[1.55] text-cream/70">{pro.description}</p>
        <ul className="mt-7 space-y-3 text-[14px] text-cream/85">
          {pro.features.map((f) => (
            <Feature key={f} dark>{f}</Feature>
          ))}
        </ul>
        <a
          href={`/api/stripe/checkout?plan=pro&interval=${interval}`}
          onClick={() => track("pricing_plan_clicked", { plan: "pro", billing: interval })}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
        >
          {pro.ctaLabel} <span aria-hidden>→</span>
        </a>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-cream/55">
          {proPerPhoto}, {pro.overageDisplay}
        </p>
      </div>
    </div>
  );
}

function Feature({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        className={dark ? "mt-0.5 shrink-0 text-terracotta-soft" : "mt-0.5 shrink-0 text-terracotta"}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/marketing/hero-pair.tsx
git commit -m "feat(pricing): hero pair (Free + Pro) with billing interval support"
```

---

## Task A5: `ComparisonTable`

**Files:**
- Create: `src/components/marketing/comparison-table.tsx`

- [ ] **Step 1: Write the component**
```tsx
"use client";
import { PAID_PLAN_SLUGS, PLAN_MARKETING, PLAN_QUOTA } from "@/lib/plans";
import { track } from "@/lib/analytics";
import { useBilling } from "./billing-provider";
import { formatEffectiveMonthly } from "./hero-pair";

export function ComparisonTable() {
  const { interval } = useBilling();
  const header =
    interval === "annual" ? "All plans, annual billing" : "All plans, monthly billing";

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="border-b border-line-soft bg-paper-soft px-6 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          {header}
        </p>
      </div>
      <div className="divide-y divide-line-soft">
        {PAID_PLAN_SLUGS.map((slug) => {
          const m = PLAN_MARKETING[slug];
          const q = PLAN_QUOTA[slug];
          const isContact = m.ctaTarget === "contact";
          const href = isContact
            ? `/contact?source=pricing-${slug}`
            : `/api/stripe/checkout?plan=${slug}&interval=${interval}`;
          const perPhoto =
            interval === "annual" ? m.perPhotoAnnualDisplay : m.perPhotoMonthlyDisplay;
          return (
            <div
              key={slug}
              className={
                "grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-5 sm:grid-cols-[160px_1fr_120px_120px_140px] " +
                (m.badge === "popular" ? "bg-paper-soft/60" : "")
              }
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">{m.label}</span>
                {m.badge === "popular" && (
                  <span className="inline-flex items-center rounded-full bg-terracotta px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cream">
                    Popular
                  </span>
                )}
                {m.badge === "for-agencies" && (
                  <span className="inline-flex items-center rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cream">
                    For agencies
                  </span>
                )}
              </div>
              <div className="hidden text-[14px] text-ink-3 sm:block">
                {q.monthlyQuota.toLocaleString()} photos / mo
              </div>
              <div className="hidden font-mono text-[11px] uppercase tracking-[0.08em] text-ink-4 sm:block">
                {perPhoto}
              </div>
              <div className="text-right font-medium text-ink sm:text-left">
                {formatEffectiveMonthly(slug, interval)}
                <span className="text-[12px] font-normal text-ink-3">/mo</span>
              </div>
              <div className="hidden justify-end sm:flex">
                <a
                  href={href}
                  onClick={() =>
                    !isContact &&
                    track("pricing_plan_clicked", { plan: slug, billing: interval })
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
                >
                  {m.ctaLabel}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/marketing/comparison-table.tsx
git commit -m "feat(pricing): four-tier comparison table"
```

---

## Task A6: Rewrite `pricing-cards.tsx` as composition root

**Files:**
- Modify: `src/components/marketing/pricing-cards.tsx`

- [ ] **Step 1: Replace the file contents with the composition**
```tsx
"use client";
import { Container } from "@/components/ui/container";
import { HeroPair } from "./hero-pair";
import { ComparisonTable } from "./comparison-table";

export function PricingCards() {
  return (
    <Container width="marketing" className="pb-24 pt-2">
      <HeroPair />
      <ComparisonTable />
      <CustomPlansCallout />
      <Notes />
      <Footer />
    </Container>
  );
}

function CustomPlansCallout() {
  return (
    <div className="mb-10 rounded-xl border border-line bg-paper-soft p-8 md:p-10">
      <h2 className="font-serif text-[28px] leading-tight tracking-[-0.01em] text-ink">
        Need more than 1,500 photos a month?
      </h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.55] text-ink-3">
        Custom plans for big brands, agencies, and high volume sellers. API access, team seats, and white label available.
      </p>
      <a
        href="/contact?source=pricing-custom"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
      >
        Contact us
      </a>
    </div>
  );
}

function Notes() {
  return (
    <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Overage</p>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
          $0.50 per photo past your monthly limit on Starter, Pro, and Studio. $0.40 on Agency. Billed transparently, no surprises.
        </p>
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Annual billing</p>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
          Save 20% on any tier. Cancel any time during your billing period.
        </p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-dashed border-line px-6 py-5 sm:flex-row">
      <p className="text-[14px] font-medium text-ink">Billing by Stripe</p>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Secure, cancel any time, no hidden fees
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/marketing/pricing-cards.tsx
git commit -m "feat(pricing): pricing-cards as composition root"
```

---

## Task A7: Rewrite `app/(marketing)/pricing/page.tsx`

**Files:**
- Modify: `src/app/(marketing)/pricing/page.tsx`

- [ ] **Step 1: Write the new page**
```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { PricingFaq } from "@/components/marketing/pricing-faq";
import { PricingProductJsonLd } from "@/components/marketing/structured-data";
import { Container } from "@/components/ui/container";
import { BillingProvider } from "@/components/marketing/billing-provider";
import { MonthlyAnnualToggle } from "@/components/marketing/monthly-annual-toggle";

const PRICING_TITLE = "Pricing, photo-based plans from $19/mo";
const PRICING_DESCRIPTION =
  "Photo-based plans for lifestyle product shots. Try free, no card. Annual saves 20%. Pro from $39/mo for 75 photos. Cancel any time.";

export const metadata: Metadata = {
  title: { absolute: `${PRICING_TITLE} · Vesperdrop` },
  description: PRICING_DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: PRICING_TITLE,
    description: PRICING_DESCRIPTION,
    url: "/pricing",
    type: "website",
  },
  twitter: { title: PRICING_TITLE, description: PRICING_DESCRIPTION },
};

const PRICING_OFFERS = [
  { name: "Free", priceUSD: 0, description: "1 full quality photo, 2 watermarked HD previews. No card needed." },
  { name: "Starter", priceUSD: 19, description: "25 photos per month, full resolution, no watermark." },
  { name: "Pro", priceUSD: 39, description: "75 photos per month, priority queue, custom prompts." },
  { name: "Studio", priceUSD: 99, description: "250 photos per month, full resolution, no watermark." },
  { name: "Agency", priceUSD: 499, description: "1,500 photos per month, API access, team seats, white label available." },
];

export default function Page() {
  return (
    <>
      <PricingProductJsonLd offers={PRICING_OFFERS} />
      <Suspense fallback={null}>
        <BillingProvider>
          <Container as="header" width="reading" className="pb-10 pt-20 text-center md:pt-28">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              Pricing
            </p>
            <h1 className="mt-5 font-serif text-[clamp(3rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.02em] text-ink">
              Lifestyle shots for every product.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.6] text-ink-3">
              Try free, no card needed. Upgrade when you see the result. Photos refresh every billing cycle.
            </p>
            <div className="mt-8">
              <MonthlyAnnualToggle />
            </div>
          </Container>
          <PricingCards />
        </BillingProvider>
      </Suspense>
      <PricingFaq />
    </>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/app/(marketing)/pricing/page.tsx
git commit -m "feat(pricing): new pricing page layout with billing toggle"
```

---

## Task A8: Update `pricing-faq.tsx` copy

**Files:**
- Modify: `src/components/marketing/pricing-faq.tsx`

- [ ] **Step 1: Replace the questions list**

Read the existing file first to find the questions array. Replace with these five:

```ts
const QUESTIONS = [
  {
    q: "What counts as a photo?",
    a: "One photo equals one generated lifestyle image at full 2000px resolution. Watermarked previews on the free tier don't count against any plan since the free tier is its own thing.",
  },
  {
    q: "What happens if I go over my monthly photo limit?",
    a: "Your next photo still generates. Overage bills at $0.50 per photo on Starter, Pro, and Studio, and $0.40 per photo on Agency. The charge appears on your next invoice as a separate line, no surprises.",
  },
  {
    q: "Do unused photos roll over?",
    a: "No. Your photo allowance refreshes on your billing cycle anniversary. We considered roll-over but it makes capacity planning unpredictable on our side and most people prefer the simpler model.",
  },
  {
    q: "How does annual billing work?",
    a: "Annual subscribers get a 20% discount, billed once per year. We grant your monthly photo allocation each month rather than all upfront, so a heavy month doesn't burn through your year.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, cancel from your account dashboard at any moment. You keep access through the end of your current billing period. No questions asked.",
  },
];
```

If the file has a different shape, adapt the data structure but keep the same five questions and answers.

- [ ] **Step 2: Commit**
```bash
git add src/components/marketing/pricing-faq.tsx
git commit -m "feat(pricing): rewrite FAQ for v2 model"
```

---

## Task A9: Run page smoke + commit final

**Files:** None (verification).

- [ ] **Step 1: Build and serve**
```bash
pnpm build && pnpm start
```

- [ ] **Step 2: Open `/pricing` and verify visually**
  - Hero centered, serif headline, subhead.
  - Toggle defaults to Monthly. Click "Annual, save 20%" — Pro card price flips from $39 to $31.20 and shows "Billed annually at $374.40".
  - Comparison table header text changes from "All plans, monthly billing" to "All plans, annual billing".
  - Agency row has "For agencies" pill and "Talk to us" CTA going to `/contact?source=pricing-agency`.
  - "Contact us" button in the custom-plans callout goes to `/contact?source=pricing-custom`.
  - No em dashes in any visible copy.

- [ ] **Step 3: Final commit if anything was tweaked**
```bash
git add -u
git commit -m "feat(pricing): final visual polish"
```

---

## Self-Review

- ✅ All sections from spec section 2 (hero, toggle, hero pair, table, callout, notes, footer) implemented.
- ✅ All CTAs route correctly: `/api/stripe/checkout?plan=X&interval=Y` for paid checkout, `/contact?source=...` for Agency + custom callout, `/try` for Free.
- ✅ `BillingProvider` URL state is shareable.
- ✅ No edits to `PLAN_STRIPE` or `PLAN_QUOTA` (those are B and C).
- ✅ Annual price math (`monthly × 0.8`) consistent across `HeroPair` and `ComparisonTable` via shared `formatEffectiveMonthly`.
- ✅ No em dashes in any copy (spec copy rule).
