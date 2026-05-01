import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleStripeEvent } from "./webhook";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const insertEvent = vi.fn();
const updateProfile = vi.fn();
const rpcRefill = vi.fn();
const selectProfile = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "stripe_events") {
        return { insert: (...a: unknown[]) => insertEvent(...a) };
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
  updateProfile.mockReset().mockResolvedValue({ error: null });
  rpcRefill.mockReset().mockResolvedValue({ error: null });
  selectProfile.mockReset().mockResolvedValue({ data: { id: "user-uuid" }, error: null });
  subscriptionRetrieve.mockReset().mockResolvedValue({
    id: "sub_Y",
    status: "active",
    items: { data: [{ price: { id: "price_pro" } }] },
    current_period_end: 1800000000,
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

  it("is idempotent on duplicate event ids", async () => {
    insertEvent.mockResolvedValueOnce({ error: { code: "23505" } });
    await handleStripeEvent({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_X", subscription: "sub_Y" } },
    } as never);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("downgrades plan on customer.subscription.deleted", async () => {
    await handleStripeEvent({
      id: "evt_2",
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_X" } },
    } as never);
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ plan: "free" }));
  });

  it("grants credits on invoice.payment_succeeded for a subscription invoice", async () => {
    await handleStripeEvent({
      id: "evt_3",
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

  it.each([
    { priceId: "price_starter", plan: "starter", credits: 50 },
    { priceId: "price_pro",     plan: "pro",     credits: 200 },
    { priceId: "price_studio",  plan: "studio",  credits: 1000 },
    { priceId: "price_agency",  plan: "agency",  credits: 5000 },
  ])("maps $priceId to $plan with $credits credits", async ({ priceId, plan, credits }) => {
    subscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_Y",
      status: "active",
      items: { data: [{ price: { id: priceId } }] },
      current_period_end: 1800000000,
    });
    await handleStripeEvent({
      id: `evt_tier_${plan}`,
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
          subscription: null,
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
          subscription: "sub_Y",
        },
      },
    } as never);
    expect(rpcRefill).not.toHaveBeenCalled();
  });
});
