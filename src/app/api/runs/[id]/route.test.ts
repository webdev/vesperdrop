import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: () => getUser() },
  }),
}));

const renameRunForUser = vi.fn();
const deleteRunForUser = vi.fn();
vi.mock("@/lib/db/runs", () => ({
  renameRunForUser: (...a: unknown[]) => renameRunForUser(...a),
  deleteRunForUser: (...a: unknown[]) => deleteRunForUser(...a),
  RUN_NAME_MAX_LENGTH: 80,
  // GET handler dependencies; not exercised in PATCH/DELETE tests but must not throw on import.
  getRunForUser: vi.fn(),
}));

vi.mock("@/lib/db/generations", () => ({
  listGenerationsForRun: vi.fn(),
}));
vi.mock("@/lib/db/packs", () => ({
  listPacksForRun: vi.fn(),
}));

import { DELETE, PATCH } from "./route";

const params = Promise.resolve({ id: "run-1" });

function req(body: unknown) {
  return new Request("http://localhost/api/runs/run-1", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  renameRunForUser.mockReset().mockResolvedValue(true);
  deleteRunForUser.mockReset().mockResolvedValue(true);
});

describe("PATCH /api/runs/[id]", () => {
  it("rejects unauthenticated requests", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await PATCH(req({ name: "X" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await PATCH(req("not-json"), { params });
    expect(res.status).toBe(400);
    expect(renameRunForUser).not.toHaveBeenCalled();
  });

  it("returns 400 when name is too long", async () => {
    const longName = "x".repeat(81);
    const res = await PATCH(req({ name: longName }), { params });
    expect(res.status).toBe(400);
    expect(renameRunForUser).not.toHaveBeenCalled();
  });

  it("accepts a null name (clears the custom name)", async () => {
    const res = await PATCH(req({ name: null }), { params });
    expect(res.status).toBe(200);
    expect(renameRunForUser).toHaveBeenCalledWith("run-1", "u1", null);
  });

  it("accepts a valid name and forwards user id", async () => {
    const res = await PATCH(req({ name: "Spring drop · 2026" }), { params });
    expect(res.status).toBe(200);
    expect(renameRunForUser).toHaveBeenCalledWith(
      "run-1",
      "u1",
      "Spring drop · 2026",
    );
  });

  it("returns 404 when the run is not owned by the user", async () => {
    renameRunForUser.mockResolvedValueOnce(false);
    const res = await PATCH(req({ name: "Mine" }), { params });
    expect(res.status).toBe(404);
  });

  it("returns 400 when the helper throws a validation error", async () => {
    renameRunForUser.mockRejectedValueOnce(new Error("name exceeds 80 characters"));
    const res = await PATCH(req({ name: "Mine" }), { params });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/runs/[id]", () => {
  function delReq() {
    return new Request("http://localhost/api/runs/run-1", { method: "DELETE" });
  }

  it("rejects unauthenticated requests", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await DELETE(delReq(), { params });
    expect(res.status).toBe(401);
    expect(deleteRunForUser).not.toHaveBeenCalled();
  });

  it("returns 404 when the run is not owned by the user", async () => {
    deleteRunForUser.mockResolvedValueOnce(false);
    const res = await DELETE(delReq(), { params });
    expect(res.status).toBe(404);
  });

  it("deletes a run and returns ok", async () => {
    const res = await DELETE(delReq(), { params });
    expect(res.status).toBe(200);
    expect(deleteRunForUser).toHaveBeenCalledWith("run-1", "u1");
  });
});
