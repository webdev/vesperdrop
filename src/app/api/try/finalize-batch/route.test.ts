import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabase auth mock — returns null user by default; tests override per-case.
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: () => getUser() },
  }),
}));

// Newly-minted unlock-batch token. Stable so the assertion is exact.
vi.mock("@/lib/db/unlock-batches", () => ({
  newToken: () => "fixed-test-token-32-hex-chars",
}));

// db.transaction takes a callback (tx) => Promise<T>. We hand it a fake tx
// that records insert calls so the test can assert ordering + payloads
// without spinning up a real database.
type InsertCall = { table: string; values: unknown };
const inserts: InsertCall[] = [];

// Build a chainable insert(table).values(rows).returning(...) mock that
// resolves to a synthetic id for `runs` so the route can thread runRow.id
// through to the generations + unlock_batches inserts.
function fakeTx() {
  return {
    insert: (table: unknown) => {
      // Drizzle's table object has a `Symbol(drizzle:Name)` we can read,
      // but the schema mock below assigns plain string names so we can
      // tell them apart by reference identity.
      const tableName =
        (table as { __name?: string }).__name ?? String(table);
      return {
        values: (rows: unknown) => {
          inserts.push({ table: tableName, values: rows });
          return {
            returning: async () =>
              tableName === "runs" ? [{ id: "run-xyz" }] : [],
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

// The route imports schema tables by identity; we just need stable
// references with a `__name` tag so our fakeTx can distinguish them.
vi.mock("@/lib/db/schema", () => ({
  runs: { __name: "runs" },
  generations: { __name: "generations" },
  unlockBatches: { __name: "unlockBatches" },
}));

import { POST } from "./route";

function jsonReq(body: unknown) {
  return new Request("http://localhost/api/try/finalize-batch", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function validGenerations() {
  // Three generations matching the contract: index 0 is the free
  // preview, indexes 1+ are paywalled, exactly one bonus allowed.
  return [
    {
      sceneSlug: "warm-retreat",
      sceneName: "Warm Retreat",
      outputUrl: "https://blob.example/wm-warm.png",
      rawUrl: "https://blob.example/raw-warm.png",
      isFreePreview: true,
      isBonus: false,
      focalPoint: { x: 0.5, y: 0.4, confidence: 0.9, source: "face" },
      faceBox: null,
    },
    {
      sceneSlug: "velvet-glow",
      sceneName: "Velvet Glow",
      outputUrl: "https://blob.example/wm-velvet.png",
      rawUrl: "https://blob.example/raw-velvet.png",
      isFreePreview: false,
      isBonus: false,
      focalPoint: { x: 0.5, y: 0.45, confidence: 0.85, source: "face" },
      faceBox: null,
    },
    {
      sceneSlug: "urban-canvas",
      sceneName: "Urban Canvas",
      outputUrl: "https://blob.example/wm-urban.png",
      rawUrl: "https://blob.example/raw-urban.png",
      isFreePreview: false,
      isBonus: false,
      focalPoint: { x: 0.5, y: 0.42, confidence: 0.88, source: "face" },
      faceBox: null,
    },
  ];
}

beforeEach(() => {
  inserts.length = 0;
  getUser.mockReset().mockResolvedValue({ data: { user: null } });
});

describe("POST /api/try/finalize-batch", () => {
  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(jsonReq("not-json"));
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("returns 400 when generations array is empty", async () => {
    const res = await POST(
      jsonReq({
        generations: [],
        sourceUrl: "https://blob.example/src.jpg",
      }),
    );
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("returns 400 when generations array exceeds the 6-tile cap", async () => {
    const dupes = Array.from({ length: 7 }, (_, i) => ({
      ...validGenerations()[0],
      sceneSlug: `slug-${i}`,
      isFreePreview: i === 0,
    }));
    const res = await POST(
      jsonReq({
        generations: dupes,
        sourceUrl: "https://blob.example/src.jpg",
      }),
    );
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("accepts 1-scene batches (1 free preview only)", async () => {
    const res = await POST(
      jsonReq({
        generations: validGenerations().slice(0, 1),
        sourceUrl: "https://blob.example/src.jpg",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBe("fixed-test-token-32-hex-chars");
    const gensValues = inserts[1].values as Array<Record<string, unknown>>;
    expect(gensValues).toHaveLength(1);
  });

  it("accepts 6-scene batches", async () => {
    const sixGens = Array.from({ length: 6 }, (_, i) => ({
      ...validGenerations()[0],
      sceneSlug: `slug-${i}`,
      isFreePreview: i === 0,
    }));
    const res = await POST(
      jsonReq({
        generations: sixGens,
        sourceUrl: "https://blob.example/src.jpg",
      }),
    );
    expect(res.status).toBe(201);
    const gensValues = inserts[1].values as Array<Record<string, unknown>>;
    expect(gensValues).toHaveLength(6);
  });

  it("accepts a client-minted 32-hex token and uses it as the batch primary key", async () => {
    const supplied = "abcdef0123456789abcdef0123456789";
    const res = await POST(
      jsonReq({
        generations: validGenerations(),
        sourceUrl: "https://blob.example/src.jpg",
        token: supplied,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBe(supplied);
    const batchValues = inserts[2].values as Record<string, unknown>;
    expect(batchValues.token).toBe(supplied);
  });

  it("rejects a malformed token", async () => {
    const res = await POST(
      jsonReq({
        generations: validGenerations(),
        sourceUrl: "https://blob.example/src.jpg",
        token: "not-a-32-hex-string",
      }),
    );
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("returns 400 when the first generation is not the free preview", async () => {
    const gens = validGenerations();
    gens[0].isFreePreview = false;
    gens[1].isFreePreview = true;
    const res = await POST(
      jsonReq({ generations: gens, sourceUrl: "https://blob.example/src.jpg" }),
    );
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("writes run + 3 generations + unlock_batches in one transaction (anon)", async () => {
    const res = await POST(
      jsonReq({
        generations: validGenerations(),
        sourceUrl: "https://blob.example/src.jpg",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBe("fixed-test-token-32-hex-chars");
    expect(body.runId).toBe("run-xyz");

    // Inserts happened in the right order: run first (so generations
    // can point at runRow.id), then the 3 generation rows, then the
    // unlock_batches row.
    expect(inserts.map((i) => i.table)).toEqual([
      "runs",
      "generations",
      "unlockBatches",
    ]);

    const runValues = inserts[0].values as Record<string, unknown>;
    expect(runValues.userId).toBeNull();
    expect(runValues.sourceCount).toBe(1);
    expect(runValues.presetCount).toBe(3);
    expect(runValues.totalImages).toBe(3);

    const gensValues = inserts[1].values as Array<Record<string, unknown>>;
    expect(gensValues).toHaveLength(3);
    for (const g of gensValues) {
      expect(g.runId).toBe("run-xyz");
      expect(g.userId).toBeNull();
      expect(g.status).toBe("succeeded");
      expect(g.watermarked).toBe(true);
      // sourceUrl from the request lands on sceneify_source_id.
      expect(g.sceneifySourceId).toBe("https://blob.example/src.jpg");
      // raw_url populated so the unlock webhook can promote it to
      // output_url after payment.
      expect(g.rawUrl).toMatch(/^https:\/\/blob\.example\/raw-/);
    }

    const batchValues = inserts[2].values as Record<string, unknown>;
    expect(batchValues.token).toBe("fixed-test-token-32-hex-chars");
    expect(batchValues.runId).toBe("run-xyz");
    expect(batchValues.userId).toBeNull();
    // JSONB payload mirrors the generations including focal data.
    const stored = batchValues.generations as Array<Record<string, unknown>>;
    expect(stored).toHaveLength(3);
    expect(stored[0].focalPoint).toBeDefined();
  });

  it("attaches the run to the authed user when a session is present", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { id: "user-9" } },
    });
    const res = await POST(
      jsonReq({
        generations: validGenerations(),
        sourceUrl: "https://blob.example/src.jpg",
      }),
    );
    expect(res.status).toBe(201);
    const runValues = inserts[0].values as Record<string, unknown>;
    expect(runValues.userId).toBe("user-9");
    const gensValues = inserts[1].values as Array<Record<string, unknown>>;
    for (const g of gensValues) expect(g.userId).toBe("user-9");
    const batchValues = inserts[2].values as Record<string, unknown>;
    expect(batchValues.userId).toBe("user-9");
  });

  it("falls back sceneify_source_id to outputUrl[0] when sourceUrl is missing", async () => {
    // Older clients (pre-DB-writes refactor) didn't send sourceUrl; the
    // route must still accept the request and write a non-null column.
    const res = await POST(jsonReq({ generations: validGenerations() }));
    expect(res.status).toBe(201);
    const gensValues = inserts[1].values as Array<Record<string, unknown>>;
    expect(gensValues[0].sceneifySourceId).toBe(
      "https://blob.example/wm-warm.png",
    );
  });
});
