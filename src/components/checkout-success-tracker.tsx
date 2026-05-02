"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * Mounted on the post-checkout success page (e.g. `/account?upgraded=1`).
 *
 * Stripe redirects to the success URL immediately, but the webhook that
 * actually grants credits and updates `profiles.plan` fires asynchronously
 * and typically completes 1–3s later. Without help, the user lands on
 * `/account` while the server still reads stale credit/plan values.
 *
 * We re-run the server components a handful of times so the AppNav credit
 * pill and the PlanSummaryCard reflect the new state without a manual
 * refresh. The delays bracket the typical webhook latency window.
 */
export function CheckoutSuccessTracker({
  source,
}: {
  source: "subscription" | "pack";
}) {
  const router = useRouter();

  useEffect(() => {
    track("checkout_success", { source });

    const delays = [1500, 4000, 9000];
    const timers = delays.map((delay) =>
      window.setTimeout(() => router.refresh(), delay),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [source, router]);

  return null;
}
