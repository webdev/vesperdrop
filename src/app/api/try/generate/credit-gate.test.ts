import { describe, it, expect, vi, beforeEach } from "vitest";

// /api/try/generate is a streaming SSE handler — its happy path is
// hard to test in isolation. These tests target the credit-gate
// branch specifically: when credits are exhausted, the route returns
// 402 with the right error code BEFORE any Sceneify/Blob work fires.
// We mock everything the route imports and assert the response shape.

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: () => getUser() },
  }),
}));

const cookieGet = vi.fn();
const cookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (...a: unknown[]) => cookieGet(...a),
    set: (...a: unknown[]) => cookieSet(...a),
  }),
}));

const getOrCreateAnonCredit = vi.fn();
const tryConsumeAnonCredit = vi.fn();
vi.mock("@/lib/db/anon-credits", () => ({
  ANON_COOKIE_NAME: "vd_try_anon",
  ANON_COOKIE_MAX_AGE_SECONDS: 31536000,
  getOrCreateAnonCredit: (...a: unknown[]) =>
    (getOrCreateAnonCredit as (...x: unknown[]) => unknown)(...a),
  tryConsumeAnonCredit: (...a: unknown[]) =>
    (tryConsumeAnonCredit as (...x: unknown[]) => unknown)(...a),
}));

const tryConsumeQuota = vi.fn();
vi.mock("@/lib/db/quota", () => ({
  tryConsumeQuota: (...a: unknown[]) =>
    (tryConsumeQuota as (...x: unknown[]) => unknown)(...a),
}));

// Sceneify + watermark + storage + extract — never reached in
// the credit-gate failure path, but the route imports them at the
// top level. Mock to no-ops.
vi.mock("@/lib/ai/sceneify", () => ({
  generateViaSceneify: vi.fn(),
  SceneifyError: class extends Error {},
}));
vi.mock("@/lib/ai/extract-attributes", () => ({
  extractAttributes: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/watermark", () => ({ applyWatermark: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  storeWatermarked: vi.fn(),
  storeRawPreview: vi.fn(),
}));
vi.mock("@/lib/admin", () => ({ isAdminEmail: () => false }));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));
// The route imports env so it doesn't crash on parse. Provide a stub.
vi.mock("@/lib/env", () => ({
  env: { BLOB_READ_WRITE_TOKEN: "stub", SCENEIFY_API_URL: "https://stub" },
}));

import { POST } from "./route";

function form() {
  const f = new FormData();
  // Match the route's zod expectations.
  const blob = new Blob(["x"], { type: "image/png" });
  f.append("file", new File([blob], "p.png", { type: "image/png" }));
  f.append("sceneSlug", "warm-retreat");
  return f;
}

function req(formData: FormData) {
  return new Request("http://localhost/api/try/generate", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.E2E_SCENEIFY_MOCK;
  getUser.mockResolvedValue({ data: { user: null } });
  cookieGet.mockReturnValue(undefined);
  cookieSet.mockReturnValue(undefined);
});

describe("/api/try/generate credit gating", () => {
  it("returns 402 + credit_limit_reached when an anon visitor is out of credits", async () => {
    getOrCreateAnonCredit.mockResolvedValueOnce({
      anonId: "anon-1",
      created: false,
    });
    tryConsumeAnonCredit.mockResolvedValueOnce(false); // ledger empty

    const res = await POST(req(form()));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("credit_limit_reached");
    expect(body.error).toMatch(/free previews/i);

    // No Sceneify call, no blob upload — the gate fired before any
    // expensive work.
    expect(tryConsumeQuota).not.toHaveBeenCalled();
  });

  it("returns 402 + quota_exhausted when an authed user has no quota_units left", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    tryConsumeQuota.mockResolvedValueOnce(false);

    const res = await POST(req(form()));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("quota_exhausted");

    // Anon path NOT taken.
    expect(tryConsumeAnonCredit).not.toHaveBeenCalled();
    expect(tryConsumeQuota).toHaveBeenCalledWith("u1", 1);
  });

  it("sets the anon cookie when a fresh ledger row is created", async () => {
    getOrCreateAnonCredit.mockResolvedValueOnce({
      anonId: "anon-new",
      created: true,
    });
    tryConsumeAnonCredit.mockResolvedValueOnce(false); // stop before streaming

    await POST(req(form()));

    expect(cookieSet).toHaveBeenCalledOnce();
    const [name, value, opts] = cookieSet.mock.calls[0];
    expect(name).toBe("vd_try_anon");
    expect(value).toBe("anon-new");
    expect(opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("reuses an existing anon ledger row without re-setting the cookie", async () => {
    // Route reads two cookies before the credit gate: `vd_mock_gen`
    // (the local-dev mock toggle, must miss in this scenario) and
    // `vd_try_anon` (the ledger we're testing). Use a name-aware mock
    // so the order of reads in the route doesn't matter.
    cookieGet.mockImplementation((name: unknown) =>
      name === "vd_try_anon" ? { value: "anon-existing" } : undefined,
    );
    getOrCreateAnonCredit.mockResolvedValueOnce({
      anonId: "anon-existing",
      created: false,
    });
    tryConsumeAnonCredit.mockResolvedValueOnce(false);

    await POST(req(form()));

    expect(getOrCreateAnonCredit).toHaveBeenCalledWith("anon-existing");
    // Existing cookie — no re-set.
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("skips both gates entirely when E2E_SCENEIFY_MOCK=1 (dev iteration)", async () => {
    process.env.E2E_SCENEIFY_MOCK = "1";

    // Use a sceneSlug that fails validation so the route returns
    // early after the gate-check section. We just want to confirm
    // neither credit RPC fired before that point.
    const f = new FormData();
    f.append("file", new File([], "x"));
    f.append("sceneSlug", ""); // empty triggers 400

    const res = await POST(req(f));
    expect(res.status).toBe(400);
    expect(tryConsumeQuota).not.toHaveBeenCalled();
    expect(tryConsumeAnonCredit).not.toHaveBeenCalled();
    expect(getOrCreateAnonCredit).not.toHaveBeenCalled();
  });
});
