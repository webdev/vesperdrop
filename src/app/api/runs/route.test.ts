import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const profileSelectMock = vi.fn();
const tryTakeTokenMock = vi.fn();
const consumeQuotaMock = vi.fn();
const createRunMock = vi.fn();
const insertPendingGenerationsMock = vi.fn();
const startWorkflowMock = vi.fn();
const serverTrackMock = vi.fn();
const isAdminEmailMock = vi.fn();
const cookiesGetMock = vi.fn();
const putMock = vi.fn();

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
      };
    },
  },
}));

vi.mock("@/lib/db/rate-limit", () => ({
  tryTakeToken: (...a: unknown[]) => tryTakeTokenMock(...a),
}));

vi.mock("@/lib/billing/quota", () => ({
  consumeQuota: (...a: unknown[]) => consumeQuotaMock(...a),
}));

vi.mock("@/lib/db/runs", () => ({
  createRun: (...a: unknown[]) => createRunMock(...a),
}));

vi.mock("@/lib/db/generations", () => ({
  insertPendingGenerations: (...a: unknown[]) =>
    insertPendingGenerationsMock(...a),
}));

vi.mock("workflow/api", () => ({
  start: (...a: unknown[]) => startWorkflowMock(...a),
}));

vi.mock("@/lib/workflows/process-run", () => ({
  processRun: vi.fn(),
}));

vi.mock("@/lib/analytics-server", () => ({
  serverTrack: (...a: unknown[]) => serverTrackMock(...a),
}));

vi.mock("@/lib/admin", () => ({
  isAdminEmail: (...a: unknown[]) => isAdminEmailMock(...a),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookiesGetMock(name),
  }),
}));

vi.mock("@vercel/blob", () => ({
  put: (...a: unknown[]) => putMock(...a),
}));

vi.mock("@/lib/env", () => ({
  env: {
    MAX_RUN_IMAGES: 20,
    RUNS_PER_MINUTE_PER_USER: 30,
    BLOB_READ_WRITE_TOKEN: "tok_blob",
  },
}));

import { POST } from "./route";

// jsdom's Request.formData() roundtrip loses File identity (the parsed entry
// is a generic Blob-shaped object, not `instanceof File`), so we construct a
// Request-shaped object with a hand-rolled formData() that returns real File
// instances. Type-cast to Request so it lines up with the POST(req: Request)
// signature without dragging in the full Request surface area.
function makeFormReq(opts: {
  files: File[];
  presetIds: string[];
}): Request {
  const form = new FormData();
  for (const f of opts.files) form.append("files", f);
  for (const p of opts.presetIds) form.append("presetIds", p);
  return {
    url: "https://example.test/api/runs",
    method: "POST",
    headers: new Headers({ "x-forwarded-for": "1.2.3.4" }),
    formData: async () => form,
  } as unknown as Request;
}

function fakeFile(name = "p.jpg"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({
    data: { user: { id: "user-1", email: "user1@example.com" } },
  });
  profileSelectMock
    .mockReset()
    .mockResolvedValue({ data: { plan: "pro" }, error: null });
  tryTakeTokenMock.mockReset().mockResolvedValue(true);
  consumeQuotaMock
    .mockReset()
    .mockResolvedValue({ ok: true, withinCap: true });
  createRunMock.mockReset().mockResolvedValue({ id: "run-1" });
  insertPendingGenerationsMock.mockReset().mockResolvedValue(undefined);
  startWorkflowMock.mockReset().mockResolvedValue({ runId: "wf-1" });
  serverTrackMock.mockReset();
  isAdminEmailMock.mockReset().mockReturnValue(false);
  cookiesGetMock.mockReset().mockReturnValue(undefined);
  putMock
    .mockReset()
    .mockImplementation(async (key: string) => ({ url: `https://blob.test/${key}` }));
});

describe("POST /api/runs — quota gate", () => {
  it("consumes quota once per generation and marks none as overage when all within cap", async () => {
    const files = [fakeFile("a.jpg")];
    const presetIds = ["s1", "s2", "s3"];
    const res = await POST(makeFormReq({ files, presetIds }));
    expect(res.status).toBe(200);
    expect(consumeQuotaMock).toHaveBeenCalledTimes(3);
    expect(insertPendingGenerationsMock).toHaveBeenCalledTimes(1);
    const rows = insertPendingGenerationsMock.mock.calls[0]![0] as Array<{
      wasOverage: boolean;
    }>;
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.wasOverage === false)).toBe(true);
  });

  it("flags the matching row as overage when a consumeQuota result has withinCap=false", async () => {
    const files = [fakeFile("a.jpg")];
    const presetIds = ["s1", "s2", "s3"];
    consumeQuotaMock
      .mockResolvedValueOnce({ ok: true, withinCap: true })
      .mockResolvedValueOnce({ ok: true, withinCap: false })
      .mockResolvedValueOnce({ ok: true, withinCap: true });
    const res = await POST(makeFormReq({ files, presetIds }));
    expect(res.status).toBe(200);
    const rows = insertPendingGenerationsMock.mock.calls[0]![0] as Array<{
      wasOverage: boolean;
      presetId: string;
    }>;
    expect(rows.map((r) => r.wasOverage)).toEqual([false, true, false]);
  });

  it("returns 402 and inserts nothing when consumeQuota reports free_exhausted", async () => {
    const files = [fakeFile("a.jpg")];
    const presetIds = ["s1", "s2"];
    consumeQuotaMock.mockResolvedValueOnce({
      ok: false,
      reason: "free_exhausted",
    });
    const res = await POST(makeFormReq({ files, presetIds }));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      error:
        "You're out of photos for this cycle. Upgrade to keep generating.",
    });
    expect(insertPendingGenerationsMock).not.toHaveBeenCalled();
    expect(createRunMock).not.toHaveBeenCalled();
    expect(startWorkflowMock).not.toHaveBeenCalled();
    expect(serverTrackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "run_quota_exhausted",
        properties: expect.objectContaining({ reason: "free_exhausted" }),
      }),
    );
  });
});
