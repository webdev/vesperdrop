import { describe, it, expect, vi, beforeEach } from "vitest";

const updateProfile = vi.fn();
const selectProfile = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "profiles") throw new Error("unexpected table " + table);
      return {
        select: () => ({
          eq: () => ({ single: () => selectProfile() }),
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
    STRIPE_STARTER_PRICE_ID: "price_starter",
    STRIPE_PRO_PRICE_ID: "price_pro",
    STRIPE_STUDIO_PRICE_ID: "price_studio",
    STRIPE_AGENCY_PRICE_ID: "price_agency",
  },
}));

vi.mock("@/lib/ai/models", () => ({
  PLAN_MONTHLY_CREDITS: {
    free: 0,
    starter: 50,
    pro: 200,
    studio: 1000,
    agency: 5000,
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
          price: { id: opts.priceId },
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
          priceId: "price_pro",
          periodEnd: 1800000000,
        }),
      ]),
    );
    selectProfile.mockResolvedValueOnce({
      data: { id: "user-A", plan: "free", plan_renews_at: null },
      error: null,
    });

    const result = await reconcileSubscriptions();

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(updateProfile).toHaveBeenCalledWith({
      plan: "pro",
      plan_renews_at: new Date(1800000000 * 1000).toISOString(),
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
          priceId: "price_pro",
          periodEnd,
        }),
      ]),
    );
    selectProfile.mockResolvedValueOnce({
      data: {
        id: "user-A",
        plan: "pro",
        plan_renews_at: new Date(periodEnd * 1000).toISOString(),
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
          priceId: "price_starter",
          periodEnd: 1700000000,
        }),
        sub({
          id: "sub_starter2",
          customer: "cus_M",
          priceId: "price_starter",
          periodEnd: 1700100000,
        }),
        sub({
          id: "sub_pro",
          customer: "cus_M",
          priceId: "price_pro",
          periodEnd: 1800000000,
        }),
      ]),
    );
    selectProfile.mockResolvedValueOnce({
      data: { id: "user-M", plan: "starter", plan_renews_at: null },
      error: null,
    });

    const result = await reconcileSubscriptions();

    expect(result.updated).toBe(1);
    expect(updateProfile).toHaveBeenCalledWith({
      plan: "pro",
      plan_renews_at: new Date(1800000000 * 1000).toISOString(),
    });
  });

  it("counts unlinked customers when no profile matches", async () => {
    subList.mockReturnValueOnce(
      asyncIter([
        sub({
          id: "sub_x",
          customer: "cus_unknown",
          priceId: "price_pro",
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
