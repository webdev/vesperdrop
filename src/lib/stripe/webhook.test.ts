import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleStripeEvent } from "./webhook";

const insertEvent = vi.fn();
const updateProfile = vi.fn();

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
        };
      }
      throw new Error("unexpected table " + table);
    },
  },
}));

beforeEach(() => {
  insertEvent.mockReset().mockResolvedValue({ error: null });
  updateProfile.mockReset();
});

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
});
