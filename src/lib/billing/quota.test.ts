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
    (supabaseAdmin.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: null },
      error: null,
    });
    const r = await consumeQuota("user1", "run1");
    expect(r).toEqual({ ok: true, withinCap: true });
  });

  it("returns ok:true withinCap:false on paid plan when balance is 0 (overage)", async () => {
    const mod = await import("@/lib/db/quota");
    (mod.tryConsumeQuota as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    (supabaseAdmin.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: null },
      error: null,
    });
    const r = await consumeQuota("user1", "run1");
    expect(r).toEqual({ ok: true, withinCap: false });
  });

  it("returns ok:false on free plan when exhausted", async () => {
    const mod = await import("@/lib/db/quota");
    (mod.tryConsumeQuota as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    (supabaseAdmin.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { plan: "free", last_failed_run_at: null },
      error: null,
    });
    const r = await consumeQuota("user1", "run1");
    expect(r).toEqual({ ok: false, reason: "free_exhausted" });
  });

  it("skips deduction when retry within 5 minutes of last failed run", async () => {
    const mod = await import("@/lib/db/quota");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const recent = new Date(Date.now() - 60_000).toISOString();
    (supabaseAdmin.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { plan: "pro", last_failed_run_at: recent },
      error: null,
    });
    const r = await consumeQuota("user1", "run1");
    expect(mod.tryConsumeQuota).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, withinCap: true });
  });
});
