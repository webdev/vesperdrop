"use client";

import { track } from "@/lib/analytics";

export function UpgradeButton() {
  return (
    <a
      href="/api/stripe/checkout"
      onClick={() => track("upgrade_clicked", { location: "account" })}
      className="bg-[var(--color-ember)] text-white px-4 py-2 rounded"
    >
      Upgrade to Pro
    </a>
  );
}
