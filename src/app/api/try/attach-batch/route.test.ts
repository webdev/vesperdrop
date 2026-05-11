import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: () => getUser() },
  }),
}));

const getUnlockBatchByToken = vi.fn();
vi.mock("@/lib/db/unlock-batches", () => ({
  getUnlockBatchByToken: (...a: unknown[]) =>
    (getUnlockBatchByToken as (...x: unknown[]) => unknown)(...a),
}));

// Mock the transactional update chain. The route does:
//   tx.update(unlockBatches).set(...).where(...).returning(...)
//   tx.update(runs).set(...).where(...).returning(...)
//   tx.update(generations).set(...).where(...).returning(...)
// Each test sets up the returning() shape so we can simulate the
// guarded paths (WHERE user_id IS NULL).
type UpdateCall = { table: string; values: unknown };
const updates: UpdateCall[] = [];
let unlockBatchesUpdateReturn: Array<{ runId: string | null }> = [];
let runsUpdateReturn: Array<{ id: string }> = [];
let generationsUpdateReturn: Array<{ id: string }> = [];

function fakeTx() {
  return {
    update: (table: unknown) => {
      const tableName = (table as { __name?: string }).__name ?? String(table);
      return {
        set: (values: unknown) => {
          updates.push({ table: tableName, values });
          return {
            where: () => ({
              returning: async () => {
                if (tableName === "unlockBatches")
                  return unlockBatchesUpdateReturn;
                if (tableName === "runs") return runsUpdateReturn;
                if (tableName === "generations") return generationsUpdateReturn;
                return [];
              },
            }),
          };
        },
      };
    },
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    transaction: async (fn: (tx: ReturnType<typeof fakeTx>) => unknown) =>
      fn(fakeTx()),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  runs: { __name: "runs", id: "runs.id", userId: "runs.userId" },
  generations: {
    __name: "generations",
    runId: "generations.runId",
    userId: "generations.userId",
    id: "generations.id",
  },
  unlockBatches: {
    __name: "unlockBatches",
    token: "unlockBatches.token",
    userId: "unlockBatches.userId",
    runId: "unlockBatches.runId",
  },
}));

// drizzle-orm helpers — return marker objects; we don't introspect them.
vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ kind: "and", a }),
  eq: (col: unknown, val: unknown) => ({ kind: "eq", col, val }),
  isNull: (col: unknown) => ({ kind: "isNull", col }),
}));

import { POST } from "./route";

function jsonReq(body: unknown) {
  return new Request("http://localhost/api/try/attach-batch", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  updates.length = 0;
  unlockBatchesUpdateReturn = [];
  runsUpdateReturn = [];
  generationsUpdateReturn = [];
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  getUnlockBatchByToken.mockReset();
});

describe("POST /api/try/attach-batch", () => {
  it("returns 401 when no session", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(jsonReq({ token: "tok-abc-32hexcharstoken-fixedvaluexxx" }));
    expect(res.status).toBe(401);
    expect(updates).toHaveLength(0);
  });

  it("returns 400 on invalid input (missing token)", async () => {
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the batch token is unknown", async () => {
    getUnlockBatchByToken.mockResolvedValueOnce(null);
    const res = await POST(jsonReq({ token: "tok-missing-32hexcharstoken-fixedval" }));
    expect(res.status).toBe(404);
  });

  it("returns 200 + alreadyAttached when the batch is already owned by this user", async () => {
    getUnlockBatchByToken.mockResolvedValueOnce({
      token: "tok-abc-32hexcharstoken-fixedvaluexxx",
      userId: "u1",
      runId: "run-1",
    });
    const res = await POST(jsonReq({ token: "tok-abc-32hexcharstoken-fixedvaluexxx" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyAttached).toBe(true);
    // No update fired — already attached.
    expect(updates).toHaveLength(0);
  });

  it("returns 409 when the batch belongs to a different user", async () => {
    getUnlockBatchByToken.mockResolvedValueOnce({
      token: "tok-abc-32hexcharstoken-fixedvaluexxx",
      userId: "u2",
      runId: "run-1",
    });
    const res = await POST(jsonReq({ token: "tok-abc-32hexcharstoken-fixedvaluexxx" }));
    expect(res.status).toBe(409);
  });

  it("re-parents the batch + run + generations in one transaction (happy path)", async () => {
    getUnlockBatchByToken.mockResolvedValueOnce({
      token: "tok-abc-32hexcharstoken-fixedvaluexxx",
      userId: null, // anon batch
      runId: "run-1",
    });
    // Successful guard: unlock_batches WHERE user_id IS NULL matched.
    unlockBatchesUpdateReturn = [{ runId: "run-1" }];
    runsUpdateReturn = [{ id: "run-1" }];
    generationsUpdateReturn = [{ id: "g1" }, { id: "g2" }, { id: "g3" }];

    const res = await POST(jsonReq({ token: "tok-abc-32hexcharstoken-fixedvaluexxx" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.runUpdated).toBe(true);
    expect(body.generationsUpdated).toBe(3);

    // All three tables touched in order, all setting user_id = u1.
    expect(updates.map((u) => u.table)).toEqual([
      "unlockBatches",
      "runs",
      "generations",
    ]);
    expect((updates[0].values as { userId: string }).userId).toBe("u1");
    expect((updates[1].values as { userId: string }).userId).toBe("u1");
    expect((updates[2].values as { userId: string }).userId).toBe("u1");
  });

  it("returns ok:true even when the batch row was already attached (race recovery)", async () => {
    // Batch.userId looked null on the initial read but the WHERE
    // user_id IS NULL guard found zero rows (concurrent claim won).
    // The route re-reads and reports alreadyAttached when the
    // current owner matches.
    getUnlockBatchByToken
      .mockResolvedValueOnce({ token: "tok-abc-32hexcharstoken-fixedvaluexxx", userId: null, runId: "run-1" })
      .mockResolvedValueOnce({ token: "tok-abc-32hexcharstoken-fixedvaluexxx", userId: "u1", runId: "run-1" });
    unlockBatchesUpdateReturn = []; // guard didn't match

    const res = await POST(jsonReq({ token: "tok-abc-32hexcharstoken-fixedvaluexxx" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyAttached).toBe(true);
  });

  it("skips run/generation updates when the batch has no run_id (legacy batches)", async () => {
    getUnlockBatchByToken.mockResolvedValueOnce({
      token: "tok-old-32hexcharstoken-fixedvaluexxx",
      userId: null,
      runId: null, // pre-DB-rows migration
    });
    unlockBatchesUpdateReturn = [{ runId: null }];

    const res = await POST(jsonReq({ token: "tok-old-32hexcharstoken-fixedvaluexxx" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.runUpdated).toBe(false);
    // Only the unlock_batches row was touched; no run/gen updates fired.
    expect(updates.map((u) => u.table)).toEqual(["unlockBatches"]);
  });
});
