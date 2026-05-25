import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB fake ────────────────────────────────────────────────────────
// flushPendingBatchEmail / stashPendingEmail exercise a small set of
// chainable drizzle calls. We model the rows in memory keyed by token,
// and implement only the chain shapes the module actually uses:
//
//   db.transaction(fn)                       (atomic claim + stash)
//   tx.update(t).set(v).where(w).returning(r) (claim latch)
//   tx.insert(t).values(v).onConflictDoUpdate(c) (stash upsert)
//   tx.insert(t).values(v).returning(r)      (try_intents row)
//   db.update(t).set(v).where(w)             (releaseLatch)
//   db.select(c).from(t).where(w).limit(n)   (read-back / photos)
//
// The where()/onConflict predicates are opaque markers; the fake decides
// behavior from the in-memory state + the values passed to set(), which
// is enough to prove the idempotency latch.

type BatchRow = {
  token: string;
  generations: unknown;
  userId: string | null;
  runId: string | null;
  pendingEmail: string | null;
  emailSentAt: Date | null;
  emailSendAttempts: number;
};

type GenRow = {
  runId: string | null;
  presetId: string;
  rawUrl: string | null;
  outputUrl: string | null;
  status: string;
};

const state = {
  batches: new Map<string, BatchRow>(),
  generations: [] as GenRow[],
  intents: [] as Record<string, unknown>[],
  // The token the current update().where() targets — set by eq() marker.
  lastEqToken: null as string | null,
};

// drizzle eq(col, val): we only ever eq() on the token column for
// updates/reads, so capture the value as the active token.
vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ kind: "and", a }),
  eq: (col: unknown, val: unknown) => ({ kind: "eq", col, val }),
  isNull: (col: unknown) => ({ kind: "isNull", col }),
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
    kind: "sql",
    strings,
    vals,
  }),
}));

vi.mock("@/lib/db/schema", () => ({
  unlockBatches: {
    __name: "unlockBatches",
    token: "unlockBatches.token",
    emailSentAt: "unlockBatches.emailSentAt",
    emailSendAttempts: "unlockBatches.emailSendAttempts",
  },
  generations: { __name: "generations", runId: "generations.runId" },
  tryIntents: { __name: "tryIntents", id: "tryIntents.id" },
}));

function tableName(t: unknown): string {
  return (t as { __name?: string }).__name ?? String(t);
}

// Extract a token from a where() predicate built from eq markers.
function tokenFromWhere(where: unknown): string | null {
  const visit = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    const n = node as { kind?: string; col?: unknown; val?: unknown; a?: unknown[] };
    if (n.kind === "eq" && n.col === "unlockBatches.token")
      return n.val as string;
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

// Does the where() predicate require emailSentAt IS NULL?
function requiresNotSent(where: unknown): boolean {
  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== "object") return false;
    const n = node as { kind?: string; col?: unknown; a?: unknown[] };
    if (n.kind === "isNull" && n.col === "unlockBatches.emailSentAt")
      return true;
    if (n.kind === "and" && Array.isArray(n.a)) return n.a.some(visit);
    return false;
  };
  return visit(where);
}

function makeDb() {
  const update = (table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: (where: unknown) => {
        const apply = () => {
          if (tableName(table) !== "unlockBatches") return [];
          const token = tokenFromWhere(where);
          if (!token) return [];
          const row = state.batches.get(token);
          if (!row) return [];
          if (requiresNotSent(where) && row.emailSentAt !== null) return [];
          // Apply set(): emailSentAt, emailSendAttempts (sql increment),
          // pendingEmail.
          if ("emailSentAt" in values)
            row.emailSentAt = values.emailSentAt as Date | null;
          if ("emailSendAttempts" in values) row.emailSendAttempts += 1;
          if ("pendingEmail" in values)
            row.pendingEmail = values.pendingEmail as string | null;
          return [
            { pendingEmail: row.pendingEmail, runId: row.runId },
          ];
        };
        const result = apply();
        const chain = {
          returning: async () => result,
          then: (res: (v: unknown) => unknown) => res(undefined),
        };
        // releaseLatch awaits update().set().where() with no returning().
        return chain;
      },
    }),
  });

  const insert = (table: unknown) => ({
    values: (values: Record<string, unknown>) => ({
      onConflictDoUpdate: (cfg: {
        set: Record<string, unknown>;
        setWhere?: unknown;
      }) => {
        if (tableName(table) === "unlockBatches") {
          const token = values.token as string;
          const existing = state.batches.get(token);
          if (!existing) {
            state.batches.set(token, {
              token,
              generations: values.generations,
              userId: (values.userId as string | null) ?? null,
              runId: (values.runId as string | null) ?? null,
              pendingEmail: (values.pendingEmail as string | null) ?? null,
              emailSentAt: null,
              emailSendAttempts: 0,
            });
          } else {
            // setWhere: only update pendingEmail when not yet sent.
            const blocked =
              cfg.setWhere && existing.emailSentAt !== null;
            if (!blocked) {
              if ("pendingEmail" in cfg.set)
                existing.pendingEmail = cfg.set.pendingEmail as string;
              if ("generations" in cfg.set)
                existing.generations = cfg.set.generations;
              if ("runId" in cfg.set)
                existing.runId = cfg.set.runId as string;
              if ("userId" in cfg.set)
                existing.userId = cfg.set.userId as string;
            }
          }
        }
        return Promise.resolve();
      },
      returning: async () => {
        if (tableName(table) === "tryIntents") {
          const id = `intent-${state.intents.length + 1}`;
          state.intents.push({ id, ...values });
          return [{ id }];
        }
        return [];
      },
    }),
  });

  const select = () => ({
    from: (table: unknown) => ({
      where: (where: unknown) => ({
        limit: async () => {
          if (tableName(table) === "unlockBatches") {
            const token = tokenFromWhere(where);
            const row = token ? state.batches.get(token) : null;
            if (!row) return [];
            return [
              {
                pendingEmail: row.pendingEmail,
                emailSentAt: row.emailSentAt,
                runId: row.runId,
              },
            ];
          }
          return [];
        },
        // generations read has no limit() — it's awaited directly.
        then: (res: (v: unknown) => unknown) => {
          if (tableName(table) === "generations") {
            const rows = state.generations.map((g) => ({
              presetId: g.presetId,
              rawUrl: g.rawUrl,
              outputUrl: g.outputUrl,
              status: g.status,
            }));
            return res(rows);
          }
          return res([]);
        },
      }),
    }),
  });

  return {
    transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ update, insert }),
    update,
    insert,
    select,
  };
}

let db = makeDb();
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

const sendPhotosEmail = vi.fn();
vi.mock("./send-photo", () => ({
  sendPhotosEmail: (...a: unknown[]) =>
    (sendPhotosEmail as (...x: unknown[]) => unknown)(...a),
}));

vi.mock("@/lib/env", () => ({
  env: { SITE_URL: "https://vesperdrop.com" },
}));

import { flushPendingBatchEmail, stashPendingEmail } from "./deferred-send";

const TOKEN = "abcdef0123456789abcdef0123456789";

function seedBatch(over: Partial<BatchRow> = {}) {
  state.batches.set(TOKEN, {
    token: TOKEN,
    generations: [],
    userId: null,
    runId: "run-1",
    pendingEmail: "user@brand.com",
    emailSentAt: null,
    emailSendAttempts: 0,
    ...over,
  });
}

function seedSucceededGenerations() {
  state.generations = [
    { runId: "run-1", presetId: "warm", rawUrl: "https://b/raw-warm.png", outputUrl: "https://b/wm-warm.png", status: "succeeded" },
    { runId: "run-1", presetId: "velvet", rawUrl: "https://b/raw-velvet.png", outputUrl: "https://b/wm-velvet.png", status: "succeeded" },
    { runId: "run-1", presetId: "urban", rawUrl: null, outputUrl: "https://b/wm-urban.png", status: "failed" },
  ];
}

beforeEach(() => {
  state.batches.clear();
  state.generations = [];
  state.intents = [];
  db = makeDb();
  sendPhotosEmail.mockReset().mockResolvedValue({ ok: true, id: "email-1" });
});

describe("flushPendingBatchEmail", () => {
  it("sends the succeeded watermark-free photos and latches", async () => {
    seedBatch();
    seedSucceededGenerations();

    const res = await flushPendingBatchEmail(TOKEN);
    expect(res).toEqual({ status: "sent", emailId: "email-1" });
    expect(sendPhotosEmail).toHaveBeenCalledTimes(1);
    // Only the 2 succeeded tiles, raw_url preferred.
    const arg = sendPhotosEmail.mock.calls[0][0];
    expect(arg.to).toBe("user@brand.com");
    expect(arg.photos).toEqual([
      { presetId: "warm", url: "https://b/raw-warm.png" },
      { presetId: "velvet", url: "https://b/raw-velvet.png" },
    ]);
    // Latch set so a second flush is a no-op.
    expect(state.batches.get(TOKEN)!.emailSentAt).not.toBeNull();
    expect(state.batches.get(TOKEN)!.emailSendAttempts).toBe(1);
  });

  it("is idempotent — a second flush does not re-send", async () => {
    seedBatch();
    seedSucceededGenerations();

    await flushPendingBatchEmail(TOKEN);
    const second = await flushPendingBatchEmail(TOKEN);

    expect(second).toEqual({ status: "already_sent" });
    expect(sendPhotosEmail).toHaveBeenCalledTimes(1);
  });

  it("returns no_pending_email when nothing was queued", async () => {
    seedBatch({ pendingEmail: null });
    seedSucceededGenerations();

    const res = await flushPendingBatchEmail(TOKEN);
    expect(res).toEqual({ status: "no_pending_email" });
    expect(sendPhotosEmail).not.toHaveBeenCalled();
    // Latch released — no permanent block.
    expect(state.batches.get(TOKEN)!.emailSentAt).toBeNull();
  });

  it("returns no_photos and releases the latch when the run has no succeeded tiles", async () => {
    seedBatch();
    state.generations = [
      { runId: "run-1", presetId: "warm", rawUrl: null, outputUrl: "https://b/wm.png", status: "failed" },
    ];

    const res = await flushPendingBatchEmail(TOKEN);
    expect(res).toEqual({ status: "no_photos" });
    expect(sendPhotosEmail).not.toHaveBeenCalled();
    // Released so a later flush (once tiles succeed) can retry.
    expect(state.batches.get(TOKEN)!.emailSentAt).toBeNull();
  });

  it("returns no_photos when the batch has no linked run yet (email before finalize)", async () => {
    seedBatch({ runId: null });

    const res = await flushPendingBatchEmail(TOKEN);
    expect(res).toEqual({ status: "no_photos" });
    expect(state.batches.get(TOKEN)!.emailSentAt).toBeNull();
  });

  it("releases the latch and reports provider_not_configured when Resend has no key", async () => {
    seedBatch();
    seedSucceededGenerations();
    sendPhotosEmail.mockResolvedValueOnce({ ok: false, reason: "no_api_key" });

    const res = await flushPendingBatchEmail(TOKEN);
    expect(res).toEqual({ status: "provider_not_configured" });
    expect(state.batches.get(TOKEN)!.emailSentAt).toBeNull();
  });

  it("releases the latch on a transient send failure so a retry can re-claim", async () => {
    seedBatch();
    seedSucceededGenerations();
    sendPhotosEmail.mockResolvedValueOnce({
      ok: false,
      reason: "send_failed",
      message: "boom",
    });

    const res = await flushPendingBatchEmail(TOKEN);
    expect(res).toEqual({ status: "send_failed", message: "boom" });
    expect(state.batches.get(TOKEN)!.emailSentAt).toBeNull();

    // A retry now succeeds and actually sends.
    sendPhotosEmail.mockResolvedValueOnce({ ok: true, id: "email-2" });
    const retry = await flushPendingBatchEmail(TOKEN);
    expect(retry).toEqual({ status: "sent", emailId: "email-2" });
  });

  it("returns no_pending_email for an unknown token", async () => {
    const res = await flushPendingBatchEmail(TOKEN);
    expect(res).toEqual({ status: "no_pending_email" });
  });
});

describe("stashPendingEmail", () => {
  it("creates a stub batch row with the lowercased pending email + writes an intent", async () => {
    const res = await stashPendingEmail({
      token: TOKEN,
      email: "User@Brand.com",
      sourceUrl: "https://b/src.jpg",
      pickedScenes: ["warm", "velvet"],
    });

    expect(res.intentId).toBe("intent-1");
    const row = state.batches.get(TOKEN)!;
    expect(row.pendingEmail).toBe("user@brand.com");
    expect(state.intents).toHaveLength(1);
    expect(state.intents[0].email).toBe("user@brand.com");
    expect(state.intents[0].pickedScenes).toEqual(["warm", "velvet"]);
  });

  it("does not overwrite pending_email once the batch has already been sent", async () => {
    seedBatch({ pendingEmail: "first@brand.com", emailSentAt: new Date() });

    await stashPendingEmail({
      token: TOKEN,
      email: "second@brand.com",
      sourceUrl: "https://b/src.jpg",
      pickedScenes: [],
    });

    // setWhere(emailSentAt IS NULL) blocked the overwrite.
    expect(state.batches.get(TOKEN)!.pendingEmail).toBe("first@brand.com");
    // But the conversion record is still written (a second Lead intent).
    expect(state.intents).toHaveLength(1);
  });
});
