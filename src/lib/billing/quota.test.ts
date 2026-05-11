import { describe, it, expect, vi, beforeEach } from "vitest";
import { consumeQuota } from "./quota";

vi.mock("@/lib/db/quota", () => ({
  tryConsumeQuota: vi.fn(),
  getQuotaBalance: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  },
}));

describe("consumeQuota", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true withinCap:true when user has balance", async () => {
    const mod = await import("@/lib/db/quota");
    (mod.tryConsumeQuota as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    (
      (supabaseAdmin as unknown as { single: ReturnType<typeof vi.fn> }).single
    ).mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: null },
      error: null,
    });
    const r = await consumeQuota("user1");
    expect(r).toEqual({ ok: true, withinCap: true });
  });

  it("returns ok:true withinCap:false on paid plan when balance is 0 (overage)", async () => {
    const mod = await import("@/lib/db/quota");
    (mod.tryConsumeQuota as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    (
      (supabaseAdmin as unknown as { single: ReturnType<typeof vi.fn> }).single
    ).mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: null },
      error: null,
    });
    const r = await consumeQuota("user1");
    expect(r).toEqual({ ok: true, withinCap: false });
  });

  it("returns ok:false on free plan when exhausted", async () => {
    const mod = await import("@/lib/db/quota");
    (mod.tryConsumeQuota as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    (
      (supabaseAdmin as unknown as { single: ReturnType<typeof vi.fn> }).single
    ).mockResolvedValue({
      data: { plan: "free", last_failed_run_at: null },
      error: null,
    });
    const r = await consumeQuota("user1");
    expect(r).toEqual({ ok: false, reason: "free_exhausted" });
  });

  it("skips deduction when retry within 5 minutes of last failed run", async () => {
    const mod = await import("@/lib/db/quota");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const recent = new Date(Date.now() - 60_000).toISOString();
    const sa = supabaseAdmin as unknown as {
      single: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
    };
    sa.single.mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: recent },
      error: null,
    });
    // First .select() (initial read) chains to .eq().single().
    // Second .select("id") (atomic clear) is awaited directly and resolves
    // to a non-empty array, indicating this caller won the race.
    sa.select
      .mockReturnValueOnce(supabaseAdmin)
      .mockReturnValueOnce(
        Promise.resolve({ data: [{ id: "user1" }] }) as unknown as ReturnType<
          typeof vi.fn
        >,
      );
    const r = await consumeQuota("user1");
    expect(mod.tryConsumeQuota).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, withinCap: true });
  });

  it("falls through to deduction when atomic clear loses the race", async () => {
    const mod = await import("@/lib/db/quota");
    (mod.tryConsumeQuota as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const recent = new Date(Date.now() - 60_000).toISOString();
    const sa = supabaseAdmin as unknown as {
      single: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
    };
    sa.single.mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: recent },
      error: null,
    });
    // Clear returns empty array — another caller already claimed the grace.
    sa.select
      .mockReturnValueOnce(supabaseAdmin)
      .mockReturnValueOnce(
        Promise.resolve({ data: [] }) as unknown as ReturnType<typeof vi.fn>,
      );
    const r = await consumeQuota("user1");
    expect(mod.tryConsumeQuota).toHaveBeenCalledWith("user1", 1);
    expect(r).toEqual({ ok: true, withinCap: true });
  });

  it("deducts normally when last failed run is older than the 5-minute grace window", async () => {
    const mod = await import("@/lib/db/quota");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    // 10 minutes ago — well past the 5-minute grace window.
    const stale = new Date(Date.now() - 10 * 60_000).toISOString();
    (
      (supabaseAdmin as unknown as { single: ReturnType<typeof vi.fn> }).single
    ).mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: stale },
      error: null,
    });
    (mod.tryConsumeQuota as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const r = await consumeQuota("user1");
    expect(mod.tryConsumeQuota).toHaveBeenCalledWith("user1", 1);
    expect(r).toEqual({ ok: true, withinCap: true });
  });
});
