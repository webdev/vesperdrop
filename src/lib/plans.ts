import "server-only";
import { env } from "@/lib/env";

export type PlanSlug = "free" | "starter" | "pro" | "studio" | "agency";

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

export const PAID_PLAN_SLUGS = ["starter", "pro", "studio", "agency"] as const;
export type PaidPlanSlug = (typeof PAID_PLAN_SLUGS)[number];

export const PLAN_CATALOG: Record<PlanSlug, PlanRecord> = {
  free: {
    slug: "free",
    label: "Free",
    price: 0,
    credits: 0,
    perCredit: "—",
    priceIdEnv: null,
    features: [
      "1 full-resolution HD generation",
      "5 watermarked 720p previews",
      "All scene presets",
      "Email support",
    ],
  },
  starter: {
    slug: "starter",
    label: "Starter",
    price: 19,
    credits: 50,
    perCredit: "38¢",
    priceIdEnv: "STRIPE_STARTER_PRICE_ID",
    features: [
      "50 credits / month",
      "Full resolution, no watermark",
      "All scene presets",
      "Email support",
    ],
  },
  pro: {
    slug: "pro",
    label: "Pro",
    price: 49,
    credits: 200,
    perCredit: "25¢",
    priceIdEnv: "STRIPE_PRO_PRICE_ID",
    recommended: true,
    features: [
      "200 credits / month",
      "Full resolution, no watermark",
      "All scene presets + custom prompts",
      "Priority generation queue",
      "Cancel any time",
    ],
  },
  studio: {
    slug: "studio",
    label: "Studio",
    price: 149,
    credits: 1000,
    perCredit: "15¢",
    priceIdEnv: "STRIPE_STUDIO_PRICE_ID",
    features: [
      "1,000 credits / month",
      "Full resolution, no watermark",
      "All scene presets + custom prompts",
      "Priority generation queue",
      "Bulk download & CSV export",
      "Cancel any time",
    ],
  },
  agency: {
    slug: "agency",
    label: "Agency",
    price: 499,
    credits: 5000,
    perCredit: "10¢",
    priceIdEnv: "STRIPE_AGENCY_PRICE_ID",
    features: [
      "5,000 credits / month",
      "Full resolution, no watermark",
      "All scene presets + custom prompts",
      "Priority generation queue",
      "Bulk download & CSV export",
      "Dedicated Slack support",
      "Cancel any time",
    ],
  },
};

export function isPaidPlanSlug(value: string): value is PaidPlanSlug {
  return (PAID_PLAN_SLUGS as readonly string[]).includes(value);
}

export function priceIdForPlan(slug: PaidPlanSlug): string {
  const record = PLAN_CATALOG[slug];
  if (!record || !record.priceIdEnv) {
    throw new Error(`No Stripe price ID configured for plan "${slug}"`);
  }
  const value = env[record.priceIdEnv];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`env.${record.priceIdEnv} is not set`);
  }
  return value;
}
