import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportOverage } from "./overage";

vi.mock("@/lib/stripe/server", () => ({
  stripe: {
    invoiceItems: {
      create: vi.fn(),
    },
  },
}));

describe("reportOverage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls stripe.invoiceItems.create with the right shape and idempotency key", async () => {
    const { stripe } = await import("@/lib/stripe/server");
    (stripe.invoiceItems.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ii_123",
    });
    const r = await reportOverage({
      customerId: "cus_xyz",
      generationId: "gen_abc",
      cents: 50,
      description: "Overage photo",
    });
    expect(stripe.invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_xyz",
        amount: 50,
        currency: "usd",
        description: "Overage photo",
      }),
      { idempotencyKey: "overage:gen_abc" },
    );
    expect(r).toBe("ii_123");
  });

  it("returns null on Stripe error and does not throw", async () => {
    const { stripe } = await import("@/lib/stripe/server");
    (stripe.invoiceItems.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network"),
    );
    const r = await reportOverage({
      customerId: "cus_xyz",
      generationId: "gen_abc",
      cents: 50,
      description: "Overage photo",
    });
    expect(r).toBeNull();
  });
});
