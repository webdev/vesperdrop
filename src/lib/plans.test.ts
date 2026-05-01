import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_STARTER_PRICE_ID: "price_starter_test",
    STRIPE_PRO_PRICE_ID: "price_pro_test",
    STRIPE_STUDIO_PRICE_ID: "price_studio_test",
    STRIPE_AGENCY_PRICE_ID: "price_agency_test",
  },
}));

import { priceIdForPlan, PLAN_CATALOG, PAID_PLAN_SLUGS } from "./plans";

describe("priceIdForPlan", () => {
  it("returns the env-backed price ID for each paid plan", () => {
    expect(priceIdForPlan("starter")).toBe("price_starter_test");
    expect(priceIdForPlan("pro")).toBe("price_pro_test");
    expect(priceIdForPlan("studio")).toBe("price_studio_test");
    expect(priceIdForPlan("agency")).toBe("price_agency_test");
  });

  it("throws on the free slug (no price)", () => {
    expect(() => priceIdForPlan("free" as never)).toThrow();
  });

  it("throws on unknown slug", () => {
    expect(() => priceIdForPlan("enterprise" as never)).toThrow();
  });
});

describe("PLAN_CATALOG", () => {
  it("has an entry for every paid slug", () => {
    for (const slug of PAID_PLAN_SLUGS) {
      expect(PLAN_CATALOG[slug]).toBeDefined();
      expect(PLAN_CATALOG[slug].priceIdEnv).not.toBeNull();
    }
  });

  it("free entry has null priceIdEnv", () => {
    expect(PLAN_CATALOG.free.priceIdEnv).toBeNull();
  });

  it("pro is marked recommended", () => {
    expect(PLAN_CATALOG.pro.recommended).toBe(true);
  });
});
