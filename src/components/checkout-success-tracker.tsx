"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function CheckoutSuccessTracker({
  source,
}: {
  source: "subscription" | "pack";
}) {
  useEffect(() => {
    track("checkout_success", { source });
  }, [source]);
  return null;
}
