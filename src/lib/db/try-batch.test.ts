import { describe, it, expect, vi, beforeEach } from "vitest";

// Server-side per-tile persistence (VES-53). These tests prove the
// tab-closed path: tiles persisted server-side, then the batch finalizes +
// flushes the deferred email with ZERO client finalize call.
//
// We model the two tables the module touches (unlock_batches, generations)
// in memory and implement only the drizzle chain shapes it actually uses:
//
//   db.transaction(fn)                                         (ensureBatchRun)
//   tx.insert(unlockBatches).values(v).onConflictDoUpdate(c)   (stub upsert)
//   tx.select(c).from(unlockBatches).where(w).limit(n).for(s)  (locked read)
//   tx.insert(runs).values(v).returning(r)                     (run create)
//   tx.update(unlockBatches).set(v).where(w)                   (link run)
//   db.insert(generations).values(v).onConflictDoUpdate(c)     (tile upsert)
//   db.select(c).from(unlockBatches).where(w).limit(n)         (expected read)
//   db.select(c).from(generations).where(w)                    (settled read)
//   db.update(unlockBatches).set(v).where(w)                   (jsonb fill)

type BatchRow = {
  token: string;
  generations: unknown[];
  userId: string | null;
  runId: string | null;
  expectedTiles: number | null;
  pendingEmail: string | null;
};

type GenRow = {
  runId: string;
  presetId: string;
  status: string;
  outputUrl: string | null;
  rawUrl: string | null;
  focalPoint: unknown;
  faceBox: unknown;
};

const state = {
  batches: new Map<string, BatchRow>(),
  generations: [] as GenRow[],
  runSeq: 0,
};

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ kind: "and", a }),
  eq: (col: unknown, val: unknown) => ({ kind: "eq", col, val }),
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
    kind: "sql",
    strings,
    vals,
  }),
}));

vi.mock("./schema", () => ({
  unlockBatches: {
    __name: "unlockBatches",
    token: "unlockBatches.token",
    runId: "unlockBatches.runId",
    generations: "unlockBatches.generations",
    expectedTiles: "unlockBatches.expectedTiles",
  },
  runs: { __name: "runs", id: "runs.id" },
  generations: {
    __name: "generations",
    runId: "generations.runId",
    presetId: "generations.presetId",
    status: "generations.status",
  },
}));

function tableName(t: unknown): string {
  return (t as { __name?: string }).__name ?? String(t);
}

function tokenFromWhere(where: unknown): string | null {
  const visit = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    const n = node as { kind?: string; col?: unknown; val?: unknown; a?: unknown[] };
    if (n.kind === "eq" && n.col === "unlockBatches.token") return n.val as string;
    if (n.kind === "and" && Array.isArray(n.a)) {
      for (const sub of n.a) {
        const r = visit(sub);
        if (r) return r;
      }
    }
    return null;
  };
  return visit(where);
}

function runIdFromWhere(where: unknown): string | null {
  const visit = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    const n = node as { kind?: string; col?: unknown; val?: unknown; a?: unknown[] };
    if (n.kind === "eq" && n.col === "generations.runId") return n.val as string;
    if (n.kind === "and" && Array.isArray(n.a)) {
      for (const sub of n.a) {
        const r = visit(sub);
        if (r) return r;
      }
    }
    return null;
  };
  return visit(where);
}

function makeDb() {
  const insert = (table: unknown) => ({
    values: (values: Record<string, unknown>) => ({
      onConflictDoUpdate: (cfg: { set: Record<string, unknown> }) => {
        const name = tableName(table);
        if (name === "unlockBatches") {
          const token = values.token as string;
          const existing = state.batches.get(token);
          if (!existing) {
            state.batches.set(token, {
              token,
              generations: (values.generations as unknown[]) ?? [],
              userId: (values.userId as string | null) ?? null,
              runId: (values.runId as string | null) ?? null,
              expectedTiles: (values.expectedTiles as number | null) ?? null,
              pendingEmail: (values.pendingEmail as string | null) ?? null,
            });
          } else if ("expectedTiles" in cfg.set) {
            existing.expectedTiles = cfg.set.expectedTiles as number;
          }
        } else if (name === "generations") {
          const runId = values.runId as string;
          const presetId = values.presetId as string;
          const found = state.generations.find(
            (g) => g.runId === runId && g.presetId === presetId,
          );
          if (!found) {
            state.generations.push({
              runId,
              presetId,
              status: values.status as string,
              outputUrl: (values.outputUrl as string | null) ?? null,
              rawUrl: (values.rawUrl as string | null) ?? null,
              focalPoint: values.focalPoint ?? null,
              faceBox: values.faceBox ?? null,
            });
          } else {
            // CASE guard: never downgrade succeeded → failed.
            const next = cfg.set.status;
            if (typeof next === "string") found.status = next;
            else if (found.status !== "succeeded")
              found.status = "failed"; // sql CASE fallthrough
            else found.status = "succeeded";
            if ("outputUrl" in cfg.set)
              found.outputUrl = cfg.set.outputUrl as string | null;
            if ("rawUrl" in cfg.set) found.rawUrl = cfg.set.rawUrl as string | null;
          }
        }
        return Promise.resolve();
      },
      returning: async () => {
        if (tableName(table) === "runs") {
          state.runSeq += 1;
          return [{ id: `run-${state.runSeq}` }];
        }
        return [];
      },
    }),
  });

  const update = (table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: (where: unknown) => {
        if (tableName(table) === "unlockBatches") {
          const token = tokenFromWhere(where);
          const row = token ? state.batches.get(token) : null;
          if (row) {
            if ("runId" in values && row.runId === null)
              row.runId = values.runId as string;
            else if ("runId" in values) row.runId = values.runId as string;
            if ("generations" in values)
              row.generations = values.generations as unknown[];
          }
        }
        return Promise.resolve();
      },
    }),
  });

  const select = () => ({
    from: (table: unknown) => ({
      where: (where: unknown) => {
        const finish = () => {
          if (tableName(table) === "generations") {
            const runId = runIdFromWhere(where);
            return state.generations.filter((g) => g.runId === runId);
          }
          if (tableName(table) === "unlockBatches") {
            const token = tokenFromWhere(where);
            const row = token ? state.batches.get(token) : null;
            if (!row) return [];
            return [
              {
                runId: row.runId,
                expectedTiles: row.expectedTiles,
              },
            ];
          }
          return [];
        };
        return {
          // tx.select().from().where().limit().for() (locked read)
          limit: () => ({
            for: async () => finish(),
            then: (res: (v: unknown) => unknown) => res(finish()),
          }),
          // db.select().from(generations).where() awaited directly
          then: (res: (v: unknown) => unknown) => res(finish()),
        };
      },
    }),
  });

  return {
    transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ insert, update, select }),
    insert,
    update,
    select,
  };
}

let db = makeDb();
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

const flushPendingBatchEmail = vi.fn();
vi.mock("@/lib/email/deferred-send", () => ({
  flushPendingBatchEmail: (...a: unknown[]) =>
    (flushPendingBatchEmail as (...x: unknown[]) => unknown)(...a),
}));

import {
  ensureBatchRun,
  recordTileSuccess,
  recordTileFailure,
  maybeFinalizeBatch,
} from "./try-batch";

const TOKEN = "abcdef0123456789abcdef0123456789";

function baseTile(slug: string, free = false) {
  return {
    token: TOKEN,
    userId: null,
    sceneSlug: slug,
    sceneName: slug,
    isFreePreview: free,
    sourceUrl: "https://b/src.jpg",
    batchSize: 3,
  };
}

function success(slug: string, free = false) {
  return {
    ...baseTile(slug, free),
    outputUrl: `https://b/wm-${slug}.png`,
    rawUrl: `https://b/raw-${slug}.png`,
    focalPoint: null,
    faceBox: null,
  };
}

beforeEach(() => {
  state.batches.clear();
  state.generations = [];
  state.runSeq = 0;
  db = makeDb();
  flushPendingBatchEmail.mockReset().mockResolvedValue({ status: "sent", emailId: "e1" });
});

describe("ensureBatchRun", () => {
  it("creates exactly one run for a token and reuses it on repeat calls", async () => {
    const r1 = await ensureBatchRun({ token: TOKEN, batchSize: 3 });
    const r2 = await ensureBatchRun({ token: TOKEN, batchSize: 3 });
    expect(r1).toBe("run-1");
    expect(r2).toBe("run-1");
    expect(state.runSeq).toBe(1);
    expect(state.batches.get(TOKEN)!.runId).toBe("run-1");
    expect(state.batches.get(TOKEN)!.expectedTiles).toBe(3);
  });
});

describe("recordTileSuccess + maybeFinalizeBatch (tab-closed completion)", () => {
  it("persists tiles and finalizes + flushes WITHOUT a client finalize call", async () => {
    // Simulate three independent /api/try/generate requests completing
    // server-side after the visitor closed the tab. No finalize-batch.
    const r1 = await recordTileSuccess(success("warm", true));
    await maybeFinalizeBatch(TOKEN, r1);
    // Not all tiles settled yet → no flush.
    expect(flushPendingBatchEmail).not.toHaveBeenCalled();

    const r2 = await recordTileSuccess(success("velvet"));
    await maybeFinalizeBatch(TOKEN, r2);
    expect(flushPendingBatchEmail).not.toHaveBeenCalled();

    const r3 = await recordTileSuccess(success("urban"));
    await maybeFinalizeBatch(TOKEN, r3);

    // All three settled → run linked, JSONB filled, email flushed once.
    expect(flushPendingBatchEmail).toHaveBeenCalledTimes(1);
    expect(flushPendingBatchEmail).toHaveBeenCalledWith(TOKEN);
    const batch = state.batches.get(TOKEN)!;
    expect(batch.runId).toBe("run-1");
    expect(batch.generations).toHaveLength(3);
    expect((batch.generations[0] as { isFreePreview: boolean }).isFreePreview).toBe(true);
    expect(state.generations.filter((g) => g.status === "succeeded")).toHaveLength(3);
  });

  it("is idempotent across the (run, preset) upsert — same tile twice = one row", async () => {
    const r = await recordTileSuccess(success("warm", true));
    await recordTileSuccess(success("warm", true)); // auto-retry re-persist
    expect(state.generations.filter((g) => g.presetId === "warm")).toHaveLength(1);
    expect(r).toBe("run-1");
  });

  it("does not flush until expected_tiles is reached", async () => {
    const r = await recordTileSuccess(success("warm", true));
    await maybeFinalizeBatch(TOKEN, r);
    expect(flushPendingBatchEmail).not.toHaveBeenCalled();
  });
});

describe("recordTileFailure (partial failure / no hang)", () => {
  it("settles a failed tile so the batch finalizes and emails what succeeded", async () => {
    const r1 = await recordTileSuccess(success("warm", true));
    await maybeFinalizeBatch(TOKEN, r1);
    const r2 = await recordTileSuccess(success("velvet"));
    await maybeFinalizeBatch(TOKEN, r2);
    // Third tile fails (and the tab is closed, so no client retry).
    const r3 = await recordTileFailure({ ...baseTile("urban"), error: "sceneify 502" });
    await maybeFinalizeBatch(TOKEN, r3);

    // All three settled (2 ok + 1 failed) → flush fires once with the 2.
    expect(flushPendingBatchEmail).toHaveBeenCalledTimes(1);
    const batch = state.batches.get(TOKEN)!;
    expect(batch.generations).toHaveLength(2);
  });

  it("a later success overwrites a failed row and never downgrades", async () => {
    await recordTileFailure({ ...baseTile("warm", true), error: "boom" });
    expect(state.generations[0].status).toBe("failed");
    await recordTileSuccess(success("warm", true));
    expect(state.generations[0].status).toBe("succeeded");
    // And a stray failure after success does not downgrade.
    await recordTileFailure({ ...baseTile("warm", true), error: "late" });
    expect(state.generations[0].status).toBe("succeeded");
  });

  it("flushes (no-op latch path) even when every tile failed", async () => {
    flushPendingBatchEmail.mockResolvedValue({ status: "no_photos" });
    const r1 = await recordTileFailure({ ...baseTile("warm", true), error: "a" });
    await maybeFinalizeBatch(TOKEN, r1);
    const r2 = await recordTileFailure({ ...baseTile("velvet"), error: "b" });
    await maybeFinalizeBatch(TOKEN, r2);
    const r3 = await recordTileFailure({ ...baseTile("urban"), error: "c" });
    await maybeFinalizeBatch(TOKEN, r3);
    expect(flushPendingBatchEmail).toHaveBeenCalledTimes(1);
    // No JSONB written (no succeeded tiles) — stays the empty stub.
    expect(state.batches.get(TOKEN)!.generations).toHaveLength(0);
  });
});
