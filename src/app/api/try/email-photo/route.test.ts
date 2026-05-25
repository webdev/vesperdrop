import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB fake ────────────────────────────────────────────────────────
// The route uses two read chains and one insert chain:
//   db.select(c).from(unlockBatches).where().limit(1)   → batch lookup
//   db.select(c).from(runs).where().limit(1)            → run lookup
//   db.select(c).from(generations).where()              → succeeded gens
//   db.insert(tryIntents).values()                      → conversion row
// We script the returns per table via module-level fixtures.

let batchRow: { runId: string | null } | null = null;
let runRow: { id: string; userId: string | null } | null = null;
let genRows: Array<{
  presetId: string;
  rawUrl: string | null;
  outputUrl: string | null;
  sourceId: string | null;
  status: string;
}> = [];
const intentInserts: unknown[] = [];

function tableName(t: unknown): string {
  return (t as { __name?: string }).__name ?? String(t);
}

vi.mock("@/lib/db", () => {
  const select = () => ({
    from: (table: unknown) => ({
      where: () => {
        const name = tableName(table);
        const limit = async () => {
          if (name === "unlockBatches") return batchRow ? [batchRow] : [];
          if (name === "runs") return runRow ? [runRow] : [];
          return [];
        };
        return {
          limit,
          // generations read is awaited directly (no limit()).
          then: (res: (v: unknown) => unknown) =>
            res(name === "generations" ? genRows : []),
        };
      },
    }),
  });
  const insert = (table: unknown) => ({
    values: async (v: unknown) => {
      if (tableName(table) === "tryIntents") intentInserts.push(v);
    },
  });
  return { db: { select, insert } };
});

vi.mock("@/lib/db/schema", () => ({
  unlockBatches: { __name: "unlockBatches", token: "unlockBatches.token", runId: "unlockBatches.runId" },
  runs: { __name: "runs", id: "runs.id", userId: "runs.userId" },
  generations: {
    __name: "generations",
    runId: "generations.runId",
    userId: "generations.userId",
    presetId: "generations.presetId",
  },
  tryIntents: { __name: "tryIntents" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ kind: "and", a }),
  eq: (col: unknown, val: unknown) => ({ kind: "eq", col, val }),
  isNull: (col: unknown) => ({ kind: "isNull", col }),
}));

const sendPhotosEmail = vi.fn();
vi.mock("@/lib/email/send-photo", () => ({
  sendPhotosEmail: (...a: unknown[]) =>
    (sendPhotosEmail as (...x: unknown[]) => unknown)(...a),
}));

const stashPendingEmail = vi.fn();
const flushPendingBatchEmail = vi.fn();
vi.mock("@/lib/email/deferred-send", () => ({
  stashPendingEmail: (...a: unknown[]) =>
    (stashPendingEmail as (...x: unknown[]) => unknown)(...a),
  flushPendingBatchEmail: (...a: unknown[]) =>
    (flushPendingBatchEmail as (...x: unknown[]) => unknown)(...a),
}));

vi.mock("@/lib/env", () => ({
  env: { SITE_URL: "https://vesperdrop.com" },
}));

import { POST } from "./route";

const TOKEN = "abcdef0123456789abcdef0123456789";
const RUN_ID = "3f9a1c2e-4b6d-4a2f-8e1c-9d7b6a5e4f3a";

function req(body: unknown, ip = "1.2.3.4") {
  return new Request("http://localhost/api/try/email-photo", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  batchRow = null;
  runRow = null;
  genRows = [];
  intentInserts.length = 0;
  sendPhotosEmail.mockReset().mockResolvedValue({ ok: true, id: "email-1" });
  stashPendingEmail.mockReset().mockResolvedValue({ intentId: "intent-1" });
  flushPendingBatchEmail.mockReset().mockResolvedValue({ status: "sent", emailId: "email-1" });
});

describe("POST /api/try/email-photo", () => {
  it("rejects a body with neither runId nor token", async () => {
    const res = await POST(req({ email: "a@b.com" }, "ip-neither"));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const res = await POST(req({ email: "nope", token: TOKEN }, "ip-bademail"));
    expect(res.status).toBe(400);
  });

  it("State 1: sends immediately when the run has succeeded photos (runId)", async () => {
    runRow = { id: RUN_ID, userId: null };
    genRows = [
      { presetId: "warm", rawUrl: "https://b/raw-warm.png", outputUrl: "https://b/wm.png", sourceId: "https://b/src.jpg", status: "succeeded" },
      { presetId: "velvet", rawUrl: null, outputUrl: "https://b/wm-velvet.png", sourceId: "https://b/src.jpg", status: "failed" },
    ];

    const res = await POST(req({ email: "User@Brand.com", runId: RUN_ID }, "ip-state1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, state: "sent", emailed: true });
    expect(body.photos).toEqual([{ presetId: "warm", url: "https://b/raw-warm.png" }]);
    expect(sendPhotosEmail).toHaveBeenCalledTimes(1);
    // try_intents written with lowercased email + derived source.
    expect(intentInserts).toHaveLength(1);
    expect((intentInserts[0] as { email: string }).email).toBe("user@brand.com");
    expect((intentInserts[0] as { sourceUrl: string }).sourceUrl).toBe("https://b/src.jpg");
    // Did NOT stash (already sent).
    expect(stashPendingEmail).not.toHaveBeenCalled();
  });

  it("State 1 (token): routes through the latched send and dedupes on already_sent", async () => {
    runRow = { id: RUN_ID, userId: null };
    genRows = [
      { presetId: "warm", rawUrl: "https://b/raw.png", outputUrl: "https://b/wm.png", sourceId: "https://b/src.jpg", status: "succeeded" },
    ];
    batchRow = { runId: RUN_ID };
    flushPendingBatchEmail.mockResolvedValueOnce({ status: "already_sent" });

    const res = await POST(req({ email: "a@b.com", token: TOKEN }, "ip-dedupe"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Reports success without a second send (idempotent).
    expect(body).toMatchObject({ ok: true, state: "sent", emailed: true });
    expect(stashPendingEmail).toHaveBeenCalledTimes(1);
    expect(flushPendingBatchEmail).toHaveBeenCalledWith(TOKEN);
    // Direct sendPhotosEmail NOT used on the token path — flush owns it.
    expect(sendPhotosEmail).not.toHaveBeenCalled();
  });

  it("State 1: returns sent + warning when Resend is unconfigured", async () => {
    runRow = { id: RUN_ID, userId: null };
    genRows = [
      { presetId: "warm", rawUrl: "https://b/raw.png", outputUrl: "https://b/wm.png", sourceId: "https://b/src.jpg", status: "succeeded" },
    ];
    sendPhotosEmail.mockResolvedValueOnce({ ok: false, reason: "no_api_key" });

    const res = await POST(req({ email: "a@b.com", runId: RUN_ID }, "ip-noresend"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      state: "sent",
      emailed: false,
      warning: "email_provider_not_configured",
    });
  });

  it("State 2: queues for deferred send when generation is still in flight (token, no photos)", async () => {
    // Batch exists but isn't finalized — no run linked, no succeeded gens.
    batchRow = { runId: null };

    const res = await POST(
      req({ email: "Wait@Brand.com", token: TOKEN, sourceUrl: "https://b/src.jpg", pickedScenes: ["warm", "velvet"] }, "ip-state2"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, state: "queued", emailed: false });
    expect(sendPhotosEmail).not.toHaveBeenCalled();
    expect(stashPendingEmail).toHaveBeenCalledTimes(1);
    expect(stashPendingEmail.mock.calls[0][0]).toMatchObject({
      token: TOKEN,
      email: "Wait@Brand.com",
      sourceUrl: "https://b/src.jpg",
      pickedScenes: ["warm", "velvet"],
    });
  });

  it("State 2: token with a run that has no succeeded tiles yet still queues", async () => {
    batchRow = { runId: RUN_ID };
    runRow = { id: RUN_ID, userId: null };
    genRows = [
      { presetId: "warm", rawUrl: null, outputUrl: "https://b/wm.png", sourceId: "https://b/src.jpg", status: "running" },
    ];

    const res = await POST(req({ email: "a@b.com", token: TOKEN }, "ip-state2b"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe("queued");
    expect(stashPendingEmail).toHaveBeenCalledTimes(1);
  });

  it("404 when an explicit runId does not exist", async () => {
    runRow = null;
    const res = await POST(req({ email: "a@b.com", runId: RUN_ID }, "ip-404"));
    expect(res.status).toBe(404);
  });

  it("403 when the run is owned by an authed user", async () => {
    runRow = { id: RUN_ID, userId: "user-1" };
    const res = await POST(req({ email: "a@b.com", runId: RUN_ID }, "ip-403"));
    expect(res.status).toBe(403);
  });

  it("409 when no photos and no token to defer against", async () => {
    runRow = { id: RUN_ID, userId: null };
    genRows = [];
    const res = await POST(req({ email: "a@b.com", runId: RUN_ID }, "ip-409"));
    expect(res.status).toBe(409);
  });

  it("rate-limits after 5 requests from the same IP", async () => {
    runRow = { id: RUN_ID, userId: null };
    genRows = [
      { presetId: "warm", rawUrl: "https://b/raw.png", outputUrl: "https://b/wm.png", sourceId: "https://b/src.jpg", status: "succeeded" },
    ];
    const ip = "9.9.9.9";
    for (let i = 0; i < 5; i++) {
      const ok = await POST(req({ email: "a@b.com", runId: RUN_ID }, ip));
      expect(ok.status).toBe(200);
    }
    const sixth = await POST(req({ email: "a@b.com", runId: RUN_ID }, ip));
    expect(sixth.status).toBe(429);
  });
});
