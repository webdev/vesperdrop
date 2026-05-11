import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const profileSelectMock = vi.fn();
const profileUpdateMock = vi.fn();
const customersCreateMock = vi.fn();
const createCheckoutSessionMock = vi.fn();
const cookiesGetMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: () => getUserMock() },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "profiles") throw new Error("unexpected table " + table);
      return {
        select: () => ({
          eq: () => ({ single: () => profileSelectMock() }),
        }),
        update: (patch: unknown) => ({
          eq: (...args: unknown[]) => profileUpdateMock(patch, ...args),
        }),
      };
    },
  },
}));

vi.mock("@/lib/stripe/server", () => ({
  stripe: {
    customers: {
      create: (...a: unknown[]) => customersCreateMock(...a),
    },
  },
  createCheckoutSession: (...a: unknown[]) => createCheckoutSessionMock(...a),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookiesGetMock(name),
  }),
}));

import { GET } from "./route";

function req(qs: string): Request {
  return new Request(`https://example.test/api/stripe/checkout${qs}`, {
    method: "GET",
  });
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: null } });
  profileSelectMock
    .mockReset()
    .mockResolvedValue({ data: null, error: null });
  profileUpdateMock.mockReset().mockResolvedValue({ error: null });
  customersCreateMock.mockReset().mockResolvedValue({ id: "cus_NEW" });
  createCheckoutSessionMock
    .mockReset()
    .mockResolvedValue({ url: "https://checkout.stripe.test/abc" });
  cookiesGetMock.mockReset().mockReturnValue(undefined);
});

describe("GET /api/stripe/checkout", () => {
  it("redirects unauthed user (no plan param) to /sign-in with the default plan in next", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    const parsed = new URL(location);
    expect(parsed.pathname).toBe("/sign-in");
    expect(parsed.searchParams.get("next")).toBe(
      "/api/stripe/checkout?plan=pro&interval=monthly",
    );
  });

  it("redirects to /pricing when an invalid plan slug is supplied", async () => {
    const res = await GET(req("?plan=foo"));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/pricing");
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("redirects to /contact for the agency plan even when authed", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "u1@example.test" } },
    });
    const res = await GET(req("?plan=agency"));
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/contact");
    expect(loc.searchParams.get("source")).toBe("pricing-agency");
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("creates an annual pro checkout session for an authed user with an existing customer", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "u1@example.test" } },
    });
    profileSelectMock.mockResolvedValueOnce({
      data: { stripe_customer_id: "cus_EXISTING", email: "u1@example.test" },
      error: null,
    });
    const res = await GET(req("?plan=pro&interval=annual"));
    expect(customersCreateMock).not.toHaveBeenCalled();
    expect(createCheckoutSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "pro",
        interval: "annual",
        customerId: "cus_EXISTING",
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://checkout.stripe.test/abc",
    );
  });

  it("creates a Stripe customer when the profile has none, then opens checkout", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "u2", email: "u2@example.test" } },
    });
    profileSelectMock.mockResolvedValueOnce({
      data: { stripe_customer_id: null, email: "u2@example.test" },
      error: null,
    });
    const res = await GET(req("?plan=pro&interval=monthly"));
    expect(customersCreateMock).toHaveBeenCalledWith({
      email: "u2@example.test",
      metadata: { user_id: "u2" },
    });
    expect(profileUpdateMock).toHaveBeenCalledWith(
      { stripe_customer_id: "cus_NEW" },
      "id",
      "u2",
    );
    expect(createCheckoutSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "pro",
        interval: "monthly",
        customerId: "cus_NEW",
      }),
    );
    expect(res.status).toBe(303);
  });
});
