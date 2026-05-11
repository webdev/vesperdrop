import { describe, it, expect, vi, beforeEach } from "vitest";

const updateProfile = vi.fn();
const selectProfile = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "profiles") throw new Error("unexpected table " + table);
      // The downgrade pass uses .select(...).neq(...).not(...) and awaits
      // the chain as a thenable returning { data, error }. Resolve to an
      // empty paid-profiles list so the loop is a no-op in these tests.
      const emptyChain: {
        neq: () => typeof emptyChain;
        not: () => Promise<{ data: unknown[]; error: null }>;
      } = {
        neq: () => emptyChain,
        not: () => Promise.resolve({ data: [], error: null }),
      };
      return {
        select: () => ({
          eq: () => ({ single: () => selectProfile() }),
          neq: () => emptyChain,
        }),
        update: (patch: unknown) => ({
          eq: () => updateProfile(patch),
        }),
      };
    },
  },
}));

const subList = vi.fn();
vi.mock("@/lib/stripe/server", () => ({
  stripe: {
    subscriptions: {
      list: (...a: unknown[]) => subList(...a),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_STARTER_PRICE_ID_MONTHLY: "price_starter_m",
    STRIPE_STARTER_PRICE_ID_ANNUAL: "price_starter_y",
    STRIPE_PRO_PRICE_ID_MONTHLY: "price_pro_m",
    STRIPE_PRO_PRICE_ID_ANNUAL: "price_pro_y",
    STRIPE_STUDIO_PRICE_ID_MONTHLY: "price_studio_m",
    STRIPE_STUDIO_PRICE_ID_ANNUAL: "price_studio_y",
    STRIPE_AGENCY_PRICE_ID_MONTHLY: "price_agency_m",
    STRIPE_AGENCY_PRICE_ID_ANNUAL: "price_agency_y",
  },
}));

vi.mock("@/lib/ai/models", () => ({
  PLAN_MONTHLY_QUOTA: {
    free: 0,
    starter: 25,
    pro: 75,
    studio: 250,
    agency: 1500,
  },
}));

import { reconcileSubscriptions } from "./reconcile";

function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < items.length) return { value: items[i++], done: false };
          return { value: undefined as never, done: true };
        },
      };
    },
  };
}

function sub(opts: {
  id: string;
  customer: string;
  priceId: string;
  periodEnd: number;
  created?: number;
}) {
  return {
    id: opts.id,
    customer: opts.customer,
    created: opts.created ?? 1_700_000_000,
    items: {
      data: [
        {
          price: { id: opts.priceId, recurring: { usage_type: "licensed" } },
          current_period_end: opts.periodEnd,
        },
      ],
    },
  };
}

beforeEach(() => {
  updateProfile.mockReset().mockResolvedValue({ error: null });
  selectProfile.mockReset();
});

describe("reconcileSubscriptions", () => {
  it("updates profile when plan or renewal differs", async () => {
    subList.mockReturnValueOnce(
      asyncIter([
        sub({
          id: "sub_a",
          customer: "cus_A",
          priceId: "price_pro_m",
          periodEnd: 1800000000,
        }),
      ]),
    );
    selectProfile.mockResolvedValueOnce({
      data: {
        id: "user-A",
        plan: "free",
        plan_renews_at: null,
        plan_billing_interval: "monthly",
      },
      error: null,
    });

    const result = await reconcileSubscriptions();

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(updateProfile).toHaveBeenCalledWith({
      plan: "pro",
      plan_renews_at: new Date(1800000000 * 1000).toISOString(),
      plan_billing_interval: "monthly",
    });
    expect(result.changes[0]).toMatchObject({
      customerId: "cus_A",
      userId: "user-A",
      from: { plan: "free", renewsAt: null },
      to: { plan: "pro" },
    });
  });

  it("no-ops when profile already matches", async () => {
    const periodEnd = 1800000000;
    subList.mockReturnValueOnce(
      asyncIter([
        sub({
          id: "sub_a",
          customer: "cus_A",
          priceId: "price_pro_m",
          periodEnd,
        }),
      ]),
    );
    selectProfile.mockResolvedValueOnce({
      data: {
        id: "user-A",
        plan: "pro",
        plan_renews_at: new Date(periodEnd * 1000).toISOString(),
        plan_billing_interval: "monthly",
      },
      error: null,
    });

    const result = await reconcileSubscriptions();
    expect(result.updated).toBe(0);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("picks the highest-tier subscription when a customer has multiple", async () => {
    subList.mockReturnValueOnce(
      asyncIter([
        sub({
          id: "sub_starter1",
          customer: "cus_M",
          priceId: "price_starter_m",
          periodEnd: 1700000000,
        }),
        sub({
          id: "sub_starter2",
          customer: "cus_M",
          priceId: "price_starter_m",
          periodEnd: 1700100000,
        }),
        sub({
          id: "sub_pro",
          customer: "cus_M",
          priceId: "price_pro_m",
          periodEnd: 1800000000,
        }),
      ]),
    );
    selectProfile.mockResolvedValueOnce({
      data: {
        id: "user-M",
        plan: "starter",
        plan_renews_at: null,
        plan_billing_interval: "monthly",
      },
      error: null,
    });

    const result = await reconcileSubscriptions();

    expect(result.updated).toBe(1);
    expect(updateProfile).toHaveBeenCalledWith({
      plan: "pro",
      plan_renews_at: new Date(1800000000 * 1000).toISOString(),
      plan_billing_interval: "monthly",
    });
  });

  it("recognizes annual price IDs and persists interval", async () => {
    subList.mockReturnValueOnce(
      asyncIter([
        sub({
          id: "sub_y",
          customer: "cus_Y",
          priceId: "price_pro_y",
          periodEnd: 1900000000,
        }),
      ]),
    );
    selectProfile.mockResolvedValueOnce({
      data: {
        id: "user-Y",
        plan: "free",
        plan_renews_at: null,
        plan_billing_interval: "monthly",
      },
      error: null,
    });

    const result = await reconcileSubscriptions();
    expect(result.updated).toBe(1);
    expect(updateProfile).toHaveBeenCalledWith({
      plan: "pro",
      plan_renews_at: new Date(1900000000 * 1000).toISOString(),
      plan_billing_interval: "annual",
    });
  });

  it("ignores metered items when picking primary price", async () => {
    subList.mockReturnValueOnce(
      asyncIter([
        {
          id: "sub_mixed",
          customer: "cus_X",
          created: 1_700_000_000,
          items: {
            data: [
              {
                price: {
                  id: "price_metered_overage",
                  recurring: { usage_type: "metered" },
                },
                current_period_end: 1800000000,
              },
              {
                price: {
                  id: "price_pro_m",
                  recurring: { usage_type: "licensed" },
                },
                current_period_end: 1800000000,
              },
            ],
          },
        },
      ]),
    );
    selectProfile.mockResolvedValueOnce({
      data: {
        id: "user-X",
        plan: "free",
        plan_renews_at: null,
        plan_billing_interval: "monthly",
      },
      error: null,
    });

    const result = await reconcileSubscriptions();
    expect(result.updated).toBe(1);
    expect(updateProfile).toHaveBeenCalledWith({
      plan: "pro",
      plan_renews_at: new Date(1800000000 * 1000).toISOString(),
      plan_billing_interval: "monthly",
    });
  });

  it("counts unlinked customers when no profile matches", async () => {
    subList.mockReturnValueOnce(
      asyncIter([
        sub({
          id: "sub_x",
          customer: "cus_unknown",
          priceId: "price_pro_m",
          periodEnd: 1800000000,
        }),
      ]),
    );
    selectProfile.mockResolvedValueOnce({ data: null, error: null });

    const result = await reconcileSubscriptions();
    expect(result.scanned).toBe(1);
    expect(result.unlinked).toBe(1);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("counts unknown-price customers and skips them", async () => {
    subList.mockReturnValueOnce(
      asyncIter([
        sub({
          id: "sub_x",
          customer: "cus_X",
          priceId: "price_legacy_unknown",
          periodEnd: 1800000000,
        }),
      ]),
    );

    const result = await reconcileSubscriptions();
    expect(result.unknownPrice).toBe(1);
    expect(updateProfile).not.toHaveBeenCalled();
    expect(selectProfile).not.toHaveBeenCalled();
  });
});
