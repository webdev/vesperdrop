import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleStripeEvent } from "./webhook";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const insertEvent = vi.fn();
const selectEvent = vi.fn();
const updateEvent = vi.fn();
const updateProfile = vi.fn();
const rpcRefill = vi.fn();
const selectProfile = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "stripe_events") {
        return {
          insert: (...a: unknown[]) => insertEvent(...a),
          select: () => ({
            eq: () => ({ single: () => selectEvent() }),
          }),
          update: (patch: unknown) => ({
            eq: () => updateEvent(patch),
          }),
        };
      }
      if (table === "profiles") {
        return {
          update: (patch: unknown) => ({
            eq: () => updateProfile(patch),
          }),
          select: () => ({
            eq: () => ({
              single: () => selectProfile(),
            }),
          }),
        };
      }
      throw new Error("unexpected table " + table);
    },
  },
}));

vi.mock("@/lib/db/credits", () => ({
  refillCredits: (...a: unknown[]) => rpcRefill(...a),
}));

// Drizzle transaction stub — passes the same tx interface back into the callback
// so the per-event advisory lock can run without a real Postgres connection.
type FakeTx = { execute: (sql: unknown) => Promise<unknown[]> };
vi.mock("@/lib/db", () => {
  const tx: FakeTx = { execute: vi.fn().mockResolvedValue([]) };
  return {
    db: {
      transaction: async (fn: (tx: FakeTx) => Promise<unknown>) => fn(tx),
    },
  };
});

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: vi.fn() }),
}));

// Stripe SDK — return a canned subscription object (per-test mutable)
const subscriptionRetrieve = vi.fn();
vi.mock("@/lib/stripe/server", () => ({
  stripe: {
    subscriptions: {
      retrieve: (...a: unknown[]) => subscriptionRetrieve(...a),
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  insertEvent.mockReset().mockResolvedValue({ error: null });
  selectEvent.mockReset().mockResolvedValue({ data: null, error: null });
  updateEvent.mockReset().mockResolvedValue({ error: null });
  updateProfile.mockReset().mockResolvedValue({ error: null });
  rpcRefill.mockReset().mockResolvedValue({ error: null });
  selectProfile.mockReset().mockResolvedValue({ data: { id: "user-uuid" }, error: null });
  subscriptionRetrieve.mockReset().mockResolvedValue({
    id: "sub_Y",
    status: "active",
    items: {
      data: [
        {
          price: { id: "price_pro" },
          current_period_end: 1800000000,
        },
      ],
    },
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleStripeEvent", () => {
  it("upgrades plan on checkout.session.completed", async () => {
    await handleStripeEvent({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_X", subscription: "sub_Y" } },
    } as never);
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ plan: "pro" }));
  });

  it("is idempotent when a previous delivery already completed", async () => {
    insertEvent.mockResolvedValueOnce({ error: { code: "23505" } });
    selectEvent.mockResolvedValueOnce({
      data: { completed_at: "2026-04-29T00:00:00Z" },
      error: null,
    });
    await handleStripeEvent({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_X", subscription: "sub_Y" } },
    } as never);
    expect(updateProfile).not.toHaveBeenCalled();
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("retries when a previous delivery did not complete (completed_at is null)", async () => {
    insertEvent.mockResolvedValueOnce({ error: { code: "23505" } });
    selectEvent.mockResolvedValueOnce({
      data: { completed_at: null },
      error: null,
    });
    await handleStripeEvent({
      id: "evt_retry",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_X", subscription: "sub_Y" } },
    } as never);
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ plan: "pro" }));
    expect(updateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ completed_at: expect.any(String) }),
    );
  });

  it("does not mark complete if the handler throws", async () => {
    rpcRefill.mockRejectedValueOnce(new Error("db down"));
    await expect(
      handleStripeEvent({
        id: "evt_throws",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            customer: "cus_X",
            parent: {
              type: "subscription_details",
              subscription_details: { subscription: "sub_Y" },
            },
            billing_reason: "subscription_create",
          },
        },
      } as never),
    ).rejects.toThrow("db down");
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("downgrades plan on customer.subscription.deleted", async () => {
    await handleStripeEvent({
      id: "evt_2",
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_X" } },
    } as never);
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ plan: "free" }));
  });

  it("grants credits on invoice.payment_succeeded (Dahlia API: parent.subscription_details.subscription)", async () => {
    await handleStripeEvent({
      id: "evt_3",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus_X",
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_Y" },
          },
          billing_reason: "subscription_create",
        },
      },
    } as never);
    expect(rpcRefill).toHaveBeenCalledWith(
      "user-uuid",
      "pro",
      200,
      expect.any(String),
    );
  });

  it("still grants credits when invoice uses legacy top-level subscription field", async () => {
    await handleStripeEvent({
      id: "evt_3_legacy",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus_X",
          subscription: "sub_Y",
          billing_reason: "subscription_create",
        },
      },
    } as never);
    expect(rpcRefill).toHaveBeenCalledWith(
      "user-uuid",
      "pro",
      200,
      expect.any(String),
    );
  });

  it("uses item-level current_period_end for renewsAt (Dahlia API)", async () => {
    subscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_Y",
      status: "active",
      items: {
        data: [
          {
            price: { id: "price_pro" },
            current_period_end: 1800000000,
          },
        ],
      },
    });
    await handleStripeEvent({
      id: "evt_period_end",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus_X",
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_Y" },
          },
          billing_reason: "subscription_create",
        },
      },
    } as never);
    const isoExpected = new Date(1800000000 * 1000).toISOString();
    expect(rpcRefill).toHaveBeenCalledWith("user-uuid", "pro", 200, isoExpected);
  });

  it.each([
    { priceId: "price_starter", plan: "starter", credits: 50 },
    { priceId: "price_pro",     plan: "pro",     credits: 200 },
    { priceId: "price_studio",  plan: "studio",  credits: 1000 },
    { priceId: "price_agency",  plan: "agency",  credits: 5000 },
  ])("maps $priceId to $plan with $credits credits", async ({ priceId, plan, credits }) => {
    // uses Dahlia event shape
    subscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_Y",
      status: "active",
      items: {
        data: [
          {
            price: { id: priceId },
            current_period_end: 1800000000,
          },
        ],
      },
    });
    await handleStripeEvent({
      id: `evt_tier_${plan}`,
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus_X",
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_Y" },
          },
          billing_reason: "subscription_create",
        },
      },
    } as never);
    expect(rpcRefill).toHaveBeenCalledWith(
      "user-uuid",
      plan,
      credits,
      expect.any(String),
    );
  });

  it("skips credit grant on invoice.payment_succeeded with no subscription", async () => {
    await handleStripeEvent({
      id: "evt_4",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus_X",
          parent: { type: "manual" }, // not a subscription invoice
        },
      },
    } as never);
    expect(rpcRefill).not.toHaveBeenCalled();
  });

  it("skips credit grant when user not found in profiles", async () => {
    selectProfile.mockResolvedValueOnce({ data: null, error: null });
    await handleStripeEvent({
      id: "evt_5",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus_unknown",
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_Y" },
          },
        },
      },
    } as never);
    expect(rpcRefill).not.toHaveBeenCalled();
  });

  it("checkout.session.completed does NOT clobber plan_renews_at to null", async () => {
    await handleStripeEvent({
      id: "evt_no_clobber",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_X", subscription: "sub_Y" } },
    } as never);
    // It is fine to write `plan` here, but we must not write `plan_renews_at: null`
    // because invoice.payment_succeeded owns the renewal date and may already have
    // set it to a real value.
    const calls = updateProfile.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [patch] of calls) {
      expect(patch).not.toHaveProperty("plan_renews_at", null);
    }
  });

  it("customer.subscription.updated reads item-level current_period_end (Dahlia API)", async () => {
    await handleStripeEvent({
      id: "evt_sub_updated",
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_X",
          status: "active",
          items: {
            data: [
              {
                price: { id: "price_pro" },
                current_period_end: 1800000000,
              },
            ],
          },
        },
      },
    } as never);
    const isoExpected = new Date(1800000000 * 1000).toISOString();
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "pro", plan_renews_at: isoExpected }),
    );
  });
});
