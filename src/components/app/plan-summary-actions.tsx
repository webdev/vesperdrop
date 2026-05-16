"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";

interface Props {
  hasStripeCustomer: boolean;
  isFree: boolean;
}

export function PlanSummaryActions({ hasStripeCustomer, isFree }: Props) {
  if (hasStripeCustomer) {
    return (
      <Link
        href="/api/stripe/portal"
        onClick={() =>
          track("billing_portal_opened", { location: "account_summary" })
        }
        className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
      >
        Manage subscription
      </Link>
    );
  }
  if (isFree) {
    return (
      <a
        href="/api/stripe/checkout?plan=pro"
        onClick={() =>
          track("checkout_started", {
            kind: "subscription",
            plan: "pro",
            location: "account_summary",
          })
        }
        className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
      >
        Upgrade to Pro <span aria-hidden>→</span>
      </a>
    );
  }
  return null;
}
