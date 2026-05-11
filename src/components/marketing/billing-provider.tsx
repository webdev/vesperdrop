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
