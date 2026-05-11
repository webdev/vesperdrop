import { describe, it, expect, vi, beforeEach } from "vitest";

// markBatchPaid runs inside db.transaction. We mock the chain to
// capture both the unlock_batches update + the generations update,
// then assert the column promotion (output_url ← raw_url, watermarked
// ← false, quality ← 'hd') fires for the right run_id.
type UpdateCall = { table: string; values: Record<string, unknown> };
const updates: UpdateCall[] = [];
let firstUpdateReturn: Array<{ runId: string | null }> = [];

function fakeTx() {
  return {
    update: (table: unknown) => {
      const tableName = (table as { __name?: string }).__name ?? String(table);
      return {
        set: (values: Record<string, unknown>) => {
          updates.push({ table: tableName, values });
          const tail = {
            where: () => ({
              returning: async () =>
                tableName === "unlockBatches" ? firstUpdateReturn : [],
            }),
          };
          // generations.update path doesn't .returning() — it just awaits
          // the where(). Support both chain shapes.
          return {
            where: () => {
              if (tableName === "unlockBatches") return tail.where();
              return Promise.resolve();
            },
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
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  unlockBatches: {
    __name: "unlockBatches",
    token: "unlockBatches.token",
    runId: "unlockBatches.runId",
  },
  generations: {
    __name: "generations",
    runId: "generations.runId",
    rawUrl: "generations.rawUrl",
    outputUrl: "generations.outputUrl",
    watermarked: "generations.watermarked",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ kind: "and", a }),
  eq: (col: unknown, val: unknown) => ({ kind: "eq", col, val }),
  isNotNull: (col: unknown) => ({ kind: "isNotNull", col }),
  isNull: (col: unknown) => ({ kind: "isNull", col }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({
      kind: "sql",
      strings,
      vals,
    }),
    {},
  ),
}));

import { markBatchPaid } from "./unlock-batches";

beforeEach(() => {
  updates.length = 0;
  firstUpdateReturn = [];
});

describe("markBatchPaid", () => {
  it("flips status='paid' on unlock_batches and promotes generations.output_url → raw_url", async () => {
    firstUpdateReturn = [{ runId: "run-42" }];

    await markBatchPaid({
      token: "tok-32hexcharstoken-fixedvaluexxxxxxx",
      paymentIntent: "pi_123",
      customerEmail: "buyer@example.com",
    });

    // Two updates: unlock_batches first (to learn run_id), then
    // generations (the entitlement flip).
    expect(updates.map((u) => u.table)).toEqual([
      "unlockBatches",
      "generations",
    ]);
    expect(updates[0].values.status).toBe("paid");
    expect(updates[0].values.stripePaymentIntent).toBe("pi_123");
    expect(updates[0].values.customerEmail).toBe("buyer@example.com");
    expect(updates[0].values.paidAt).toBeInstanceOf(Date);

    expect(updates[1].values.watermarked).toBe(false);
    expect(updates[1].values.quality).toBe("hd");
    // outputUrl is set to a sql`...` template that references raw_url —
    // verify the placeholder column is included in the template.
    const outputUrlValue = updates[1].values.outputUrl as {
      kind: string;
      vals: unknown[];
    };
    expect(outputUrlValue.kind).toBe("sql");
    expect(outputUrlValue.vals).toContain("generations.rawUrl");
  });

  it("skips the generations promotion when the batch has no run_id (legacy batches)", async () => {
    firstUpdateReturn = [{ runId: null }];

    await markBatchPaid({
      token: "tok-legacy-32hexcharstokenxxxxxxxxxxx",
      paymentIntent: null,
      customerEmail: null,
    });

    expect(updates.map((u) => u.table)).toEqual(["unlockBatches"]);
  });

  it("skips the generations promotion when the unlock_batches row isn't found", async () => {
    firstUpdateReturn = []; // nothing matched the WHERE token = $1

    await markBatchPaid({
      token: "tok-gone-32hexcharstokenxxxxxxxxxxxxx",
    });

    expect(updates.map((u) => u.table)).toEqual(["unlockBatches"]);
  });
});
