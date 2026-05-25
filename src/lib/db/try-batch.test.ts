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
  error: string | null;
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
    error: "generations.error",
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
              error: (values.error as string | null) ?? null,
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
            if ("error" in cfg.set) found.error = cfg.set.error as string | null;
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
  runFinalizeGrace,
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

function failure(slug: string, opts: { free?: boolean; retryable?: boolean; error?: string } = {}) {
  return {
    ...baseTile(slug, opts.free ?? false),
    error: opts.error ?? "sceneify 502",
    retryable: opts.retryable ?? false,
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
    // Third tile fails permanently (and the tab is closed, so no client
    // retry) — a permanent failure settles immediately, no grace.
    const r3 = await recordTileFailure(failure("urban", { error: "sceneify 400" }));
    await maybeFinalizeBatch(TOKEN, r3);

    // All three settled (2 ok + 1 failed) → flush fires once with the 2.
    expect(flushPendingBatchEmail).toHaveBeenCalledTimes(1);
    const batch = state.batches.get(TOKEN)!;
    expect(batch.generations).toHaveLength(2);
  });

  it("a later success overwrites a failed row and never downgrades", async () => {
    await recordTileFailure(failure("warm", { free: true, error: "boom" }));
    expect(state.generations[0].status).toBe("failed");
    await recordTileSuccess(success("warm", true));
    expect(state.generations[0].status).toBe("succeeded");
    // And a stray failure after success does not downgrade.
    await recordTileFailure(failure("warm", { free: true, error: "late" }));
    expect(state.generations[0].status).toBe("succeeded");
  });

  it("flushes (no-op latch path) even when every tile failed", async () => {
    flushPendingBatchEmail.mockResolvedValue({ status: "no_photos" });
    const r1 = await recordTileFailure(failure("warm", { free: true, error: "a" }));
    await maybeFinalizeBatch(TOKEN, r1);
    const r2 = await recordTileFailure(failure("velvet", { error: "b" }));
    await maybeFinalizeBatch(TOKEN, r2);
    const r3 = await recordTileFailure(failure("urban", { error: "c" }));
    await maybeFinalizeBatch(TOKEN, r3);
    expect(flushPendingBatchEmail).toHaveBeenCalledTimes(1);
    // No JSONB written (no succeeded tiles) — stays the empty stub.
    expect(state.batches.get(TOKEN)!.generations).toHaveLength(0);
  });
});

describe("grace window for retryable failures (VES-53)", () => {
  // A retryable failure can settle the batch before the client's auto-retry
  // lands. maybeFinalizeBatch must HOLD the flush (return "grace") in that
  // case so the email isn't sent with a smaller-than-final set; runFinalizeGrace
  // then settles after a bounded delay regardless. A 0ms injected sleep
  // exercises the timing without real waiting.
  const noWait = () => Promise.resolve();

  it("defers finalize on a retryable failure, then includes a later success", async () => {
    const r1 = await recordTileSuccess(success("warm", true));
    expect((await maybeFinalizeBatch(TOKEN, r1)).status).toBe("pending");
    const r2 = await recordTileSuccess(success("velvet"));
    expect((await maybeFinalizeBatch(TOKEN, r2)).status).toBe("pending");

    // Third tile fails retryably and settles the batch (3/3). Finalize is
    // held open — flush must NOT fire yet.
    const r3 = await recordTileFailure(failure("urban", { retryable: true }));
    const settled = await maybeFinalizeBatch(TOKEN, r3);
    expect(settled.status).toBe("grace");
    expect(flushPendingBatchEmail).not.toHaveBeenCalled();

    // The client's auto-retry lands a success for the same tile during the
    // grace, overwriting the failed row.
    await recordTileSuccess(success("urban"));

    // Grace elapses → re-finalize. Now all three succeeded, so the email
    // includes the recovered tile.
    const ran = await runFinalizeGrace(TOKEN, r3, noWait);
    expect(ran).toBe(true);
    expect(flushPendingBatchEmail).toHaveBeenCalledTimes(1);
    const batch = state.batches.get(TOKEN)!;
    expect(batch.generations).toHaveLength(3);
    expect(state.generations.filter((g) => g.status === "succeeded")).toHaveLength(3);
  });

  it("tab closed / no retry: grace still settles and emails the succeeded subset", async () => {
    const r1 = await recordTileSuccess(success("warm", true));
    await maybeFinalizeBatch(TOKEN, r1);
    const r2 = await recordTileSuccess(success("velvet"));
    await maybeFinalizeBatch(TOKEN, r2);
    // Retryable failure, but the tab is closed — no client to retry.
    const r3 = await recordTileFailure(failure("urban", { retryable: true }));
    expect((await maybeFinalizeBatch(TOKEN, r3)).status).toBe("grace");
    expect(flushPendingBatchEmail).not.toHaveBeenCalled();

    // Grace elapses with no success having arrived → settle with the 2 that
    // succeeded. No permanent hang.
    await runFinalizeGrace(TOKEN, r3, noWait);
    expect(flushPendingBatchEmail).toHaveBeenCalledTimes(1);
    expect(state.batches.get(TOKEN)!.generations).toHaveLength(2);
  });

  it("afterGrace=true settles immediately even with a still-retryable failure", async () => {
    const r1 = await recordTileSuccess(success("warm", true));
    await maybeFinalizeBatch(TOKEN, r1);
    const r2 = await recordTileSuccess(success("velvet"));
    await maybeFinalizeBatch(TOKEN, r2);
    const r3 = await recordTileFailure(failure("urban", { retryable: true }));

    // Without afterGrace → grace. With afterGrace → finalized (the grace
    // already elapsed; we never grace twice).
    expect((await maybeFinalizeBatch(TOKEN, r3)).status).toBe("grace");
    expect((await maybeFinalizeBatch(TOKEN, r3, { afterGrace: true })).status).toBe(
      "finalized",
    );
    expect(flushPendingBatchEmail).toHaveBeenCalledTimes(1);
  });

  it("no grace for a permanent failure — settles and flushes immediately", async () => {
    const r1 = await recordTileSuccess(success("warm", true));
    await maybeFinalizeBatch(TOKEN, r1);
    const r2 = await recordTileSuccess(success("velvet"));
    await maybeFinalizeBatch(TOKEN, r2);
    const r3 = await recordTileFailure(failure("urban", { retryable: false }));
    expect((await maybeFinalizeBatch(TOKEN, r3)).status).toBe("finalized");
    expect(flushPendingBatchEmail).toHaveBeenCalledTimes(1);
  });

  it("does not double-finalize/double-email when both client + grace re-check fire", async () => {
    // Latch: the deferred-send mock returns sent once, already_sent after.
    flushPendingBatchEmail
      .mockResolvedValueOnce({ status: "sent", emailId: "e1" })
      .mockResolvedValue({ status: "already_sent" });

    const r1 = await recordTileSuccess(success("warm", true));
    await maybeFinalizeBatch(TOKEN, r1);
    const r2 = await recordTileSuccess(success("velvet"));
    await maybeFinalizeBatch(TOKEN, r2);
    const r3 = await recordTileFailure(failure("urban", { retryable: true }));
    expect((await maybeFinalizeBatch(TOKEN, r3)).status).toBe("grace");

    // Retry success arrives, then BOTH the grace re-check AND a client-driven
    // finalize fire. flushPendingBatchEmail is called more than once but the
    // latch (mock) only "sends" once — no double email.
    await recordTileSuccess(success("urban"));
    await runFinalizeGrace(TOKEN, r3, noWait);
    await maybeFinalizeBatch(TOKEN, r3, { afterGrace: true }); // simulate client finalize

    const sent = flushPendingBatchEmail.mock.results.filter(
      (r) => r.type === "return",
    );
    // Exactly one "sent"; the rest are already_sent (or none).
    const sentResults = await Promise.all(sent.map((r) => r.value));
    expect(sentResults.filter((v) => (v as { status: string }).status === "sent")).toHaveLength(1);
    expect(state.generations.filter((g) => g.status === "succeeded")).toHaveLength(3);
  });

  it("guards against overlapping grace timers within one invocation", async () => {
    const r1 = await recordTileSuccess(success("warm", true));
    await maybeFinalizeBatch(TOKEN, r1);
    const r2 = await recordTileSuccess(success("velvet"));
    await maybeFinalizeBatch(TOKEN, r2);
    const r3 = await recordTileFailure(failure("urban", { retryable: true }));
    await maybeFinalizeBatch(TOKEN, r3);

    // Two grace timers raced for the same token — only the first runs; the
    // second is rejected while the first is still pending.
    let release: () => void = () => {};
    const gate = new Promise<void>((res) => {
      release = res;
    });
    const first = runFinalizeGrace(TOKEN, r3, () => gate);
    const second = await runFinalizeGrace(TOKEN, r3, noWait);
    expect(second).toBe(false);
    release();
    expect(await first).toBe(true);
  });
});
