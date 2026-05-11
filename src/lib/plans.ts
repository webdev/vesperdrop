import "server-only";
import { env } from "@/lib/env";

export type PlanSlug = "free" | "starter" | "pro" | "studio" | "agency";
export const PAID_PLAN_SLUGS = ["starter", "pro", "studio", "agency"] as const;
export type PaidPlanSlug = (typeof PAID_PLAN_SLUGS)[number];

export function isPaidPlanSlug(value: string): value is PaidPlanSlug {
  return (PAID_PLAN_SLUGS as readonly string[]).includes(value);
}

export type BillingInterval = "monthly" | "annual";

// ---------------------------------------------------------------------------
// PLAN_MARKETING — owned by Agent A. Phase 1 ships skeleton; A rewrites with
// final copy without touching the other two exports.
// ---------------------------------------------------------------------------
export interface PlanMarketing {
  label: string;
  description: string;
  features: string[];
  badge?: "popular" | "for-agencies";
  ctaLabel: string;
  ctaTarget: "checkout" | "contact";
  perPhotoMonthlyDisplay: string;
  perPhotoAnnualDisplay: string;
  overageDisplay: string;
}

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
    description: "",
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
    description: "",
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
    description: "",
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

// ---------------------------------------------------------------------------
// PLAN_STRIPE — owned by Agent B. Reads env at access time.
// ---------------------------------------------------------------------------
export interface PlanStripe {
  monthlyPriceIdEnv: keyof typeof env;
  annualPriceIdEnv: keyof typeof env;
  overagePriceIdEnv: keyof typeof env;
}

export const PLAN_STRIPE: Record<PaidPlanSlug, PlanStripe> = {
  starter: {
    monthlyPriceIdEnv: "STRIPE_STARTER_PRICE_ID_MONTHLY",
    annualPriceIdEnv: "STRIPE_STARTER_PRICE_ID_ANNUAL",
    overagePriceIdEnv: "STRIPE_STARTER_PRICE_ID_OVERAGE",
  },
  pro: {
    monthlyPriceIdEnv: "STRIPE_PRO_PRICE_ID_MONTHLY",
    annualPriceIdEnv: "STRIPE_PRO_PRICE_ID_ANNUAL",
    overagePriceIdEnv: "STRIPE_PRO_PRICE_ID_OVERAGE",
  },
  studio: {
    monthlyPriceIdEnv: "STRIPE_STUDIO_PRICE_ID_MONTHLY",
    annualPriceIdEnv: "STRIPE_STUDIO_PRICE_ID_ANNUAL",
    overagePriceIdEnv: "STRIPE_STUDIO_PRICE_ID_OVERAGE",
  },
  agency: {
    monthlyPriceIdEnv: "STRIPE_AGENCY_PRICE_ID_MONTHLY",
    annualPriceIdEnv: "STRIPE_AGENCY_PRICE_ID_ANNUAL",
    overagePriceIdEnv: "STRIPE_AGENCY_PRICE_ID_OVERAGE",
  },
};

export function priceIdForPlan(
  slug: PaidPlanSlug,
  interval: BillingInterval = "monthly",
): string {
  const cfg = PLAN_STRIPE[slug];
  const key = interval === "annual" ? cfg.annualPriceIdEnv : cfg.monthlyPriceIdEnv;
  const value = env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`env.${String(key)} is not set`);
  }
  return value;
}

export function overagePriceIdForPlan(slug: PaidPlanSlug): string {
  const key = PLAN_STRIPE[slug].overagePriceIdEnv;
  const value = env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`env.${String(key)} is not set`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// PLAN_QUOTA — owned by Agent C.
// ---------------------------------------------------------------------------
export interface PlanQuota {
  monthlyQuota: number;
  overageCentsPerPhoto: number;
}

export const PLAN_QUOTA: Record<PlanSlug, PlanQuota> = {
  free: { monthlyQuota: 0, overageCentsPerPhoto: 0 },
  starter: { monthlyQuota: 25, overageCentsPerPhoto: 50 },
  pro: { monthlyQuota: 75, overageCentsPerPhoto: 50 },
  studio: { monthlyQuota: 250, overageCentsPerPhoto: 50 },
  agency: { monthlyQuota: 1500, overageCentsPerPhoto: 40 },
};

// ---------------------------------------------------------------------------
// Legacy PLAN_CATALOG / PlanRecord shape — kept as a thin synthesis over the
// three new exports so existing app-side consumers (account, plan-grid,
// plan-summary-card) keep working without touching every file. Agent A's
// marketing rewrite drops it from marketing consumers; app-side use is fine
// indefinitely.
// ---------------------------------------------------------------------------
const FLAT_MONTHLY_USD: Record<PlanSlug, number> = {
  free: 0,
  starter: 19,
  pro: 39,
  studio: 99,
  agency: 499,
};

export interface PlanRecord {
  slug: PlanSlug;
  label: string;
  price: number;
  credits: number;
  perCredit: string;
  priceIdEnv: keyof typeof env | null;
  recommended?: boolean;
  features: string[];
}

export const PLAN_CATALOG: Record<PlanSlug, PlanRecord> = Object.fromEntries(
  (Object.keys(PLAN_MARKETING) as PlanSlug[]).map((slug) => {
    const marketing = PLAN_MARKETING[slug];
    const quota = PLAN_QUOTA[slug];
    const isPaid = isPaidPlanSlug(slug);
    return [
      slug,
      {
        slug,
        label: marketing.label,
        price: FLAT_MONTHLY_USD[slug],
        credits: quota.monthlyQuota,
        perCredit: marketing.perPhotoMonthlyDisplay,
        priceIdEnv: isPaid ? PLAN_STRIPE[slug].monthlyPriceIdEnv : null,
        recommended: marketing.badge === "popular",
        features: marketing.features,
      },
    ];
  }),
) as Record<PlanSlug, PlanRecord>;
