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
