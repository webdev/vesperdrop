import { describe, it, expect, vi, beforeEach } from "vitest";

const selectThenable = vi.fn();
const refillQuotaMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "profiles") throw new Error("unexpected table " + table);
      // The route chains .update(...).eq(...).or(...).select(...) and awaits
      // that. Resolve the final .select(...) to whatever the test set up.
      return {
        update: () => ({
          eq: () => ({
            or: () => ({
              select: () => selectThenable(),
            }),
          }),
        }),
      };
    },
  },
}));

vi.mock("@/lib/db/quota", () => ({
  refillQuota: (...a: unknown[]) => refillQuotaMock(...a),
}));

vi.mock("@/lib/env", () => ({
  env: { CRON_SECRET: "test-secret" },
}));

import { GET } from "./route";

function req(authHeader?: string): Request {
  return new Request("https://example.test/api/cron/grant-monthly-annual-quota", {
    method: "GET",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => {
  selectThenable.mockReset().mockResolvedValue({ data: [], error: null });
  refillQuotaMock.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/cron/grant-monthly-annual-quota", () => {
  it("rejects requests without a bearer token (401)", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects requests with the wrong bearer token (401)", async () => {
    const res = await GET(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env: { CRON_SECRET: undefined } }));
    vi.doMock("@/lib/supabase/admin", () => ({
      supabaseAdmin: { from: () => ({}) },
    }));
    vi.doMock("@/lib/db/quota", () => ({ refillQuota: vi.fn() }));
    const fresh = await import("./route");
    const res = await fresh.GET(req("Bearer test-secret"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/lib/supabase/admin");
    vi.doUnmock("@/lib/db/quota");
    vi.resetModules();
  });

  it("refills quota for each claimed pro row (atomic claim returned 2 rows)", async () => {
    selectThenable.mockResolvedValueOnce({
      data: [
        { id: "u1", plan: "pro", plan_renews_at: "2026-06-01T00:00:00Z" },
        { id: "u2", plan: "pro", plan_renews_at: "2026-06-15T00:00:00Z" },
      ],
      error: null,
    });
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ granted: 2, skipped: 0 });
    expect(refillQuotaMock).toHaveBeenCalledTimes(2);
    expect(refillQuotaMock).toHaveBeenNthCalledWith(
      1,
      "u1",
      "pro",
      75,
      "2026-06-01T00:00:00Z",
    );
    expect(refillQuotaMock).toHaveBeenNthCalledWith(
      2,
      "u2",
      "pro",
      75,
      "2026-06-15T00:00:00Z",
    );
  });

  it("skips rows whose plan has zero monthly quota (e.g. free)", async () => {
    selectThenable.mockResolvedValueOnce({
      data: [
        { id: "u_free", plan: "free", plan_renews_at: null },
        { id: "u_pro", plan: "pro", plan_renews_at: "2026-06-01T00:00:00Z" },
      ],
      error: null,
    });
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ granted: 1, skipped: 1 });
    expect(refillQuotaMock).toHaveBeenCalledTimes(1);
    expect(refillQuotaMock).toHaveBeenCalledWith(
      "u_pro",
      "pro",
      75,
      "2026-06-01T00:00:00Z",
    );
  });

  it("logs but does not abort when refillQuota throws for one row", async () => {
    selectThenable.mockResolvedValueOnce({
      data: [
        { id: "u1", plan: "pro", plan_renews_at: "2026-06-01T00:00:00Z" },
        { id: "u2", plan: "pro", plan_renews_at: "2026-06-15T00:00:00Z" },
        { id: "u3", plan: "pro", plan_renews_at: "2026-07-01T00:00:00Z" },
      ],
      error: null,
    });
    refillQuotaMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("db blew up"))
      .mockResolvedValueOnce(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ granted: 2, skipped: 0 });
    expect(refillQuotaMock).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledWith(
      "[cron-annual-grant] refill failed after claim",
      expect.objectContaining({ userId: "u2" }),
    );
    errorSpy.mockRestore();
  });
});
