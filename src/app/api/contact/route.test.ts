import { describe, it, expect, vi, beforeEach } from "vitest";

const postContactToSlackMock = vi.fn();

vi.mock("@/lib/contact/slack", () => ({
  postContactToSlack: (...args: unknown[]) => postContactToSlackMock(...args),
}));

// next/headers reads from a per-request AsyncLocalStorage scope that only
// exists inside the Next runtime. In a Vitest unit context we substitute a
// thin shim that reads the inbound Request's headers off a module-scoped ref.
let currentReq: Request | null = null;
vi.mock("next/headers", () => ({
  headers: async () => currentReq?.headers ?? new Headers(),
}));

import { POST } from "./route";

function makeReq(opts: { body: unknown | string; ip?: string }): Request {
  const body =
    typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  const req = new Request("https://example.test/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": opts.ip ?? "9.9.9.9",
    },
    body,
  });
  currentReq = req;
  return req;
}

const validPayload = {
  name: "Ada",
  email: "ada@example.com",
  company: "Difference Engines",
  monthlyVolume: "1500-5000",
  message: "We make typewriters.",
  source: "pricing-agency",
};

describe("POST /api/contact", () => {
  beforeEach(() => {
    postContactToSlackMock.mockReset().mockResolvedValue(undefined);
  });

  it("accepts a valid payload, posts to Slack once, returns ok", async () => {
    const res = await POST(makeReq({ body: validPayload, ip: "1.1.1.1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(postContactToSlackMock).toHaveBeenCalledTimes(1);
    expect(postContactToSlackMock).toHaveBeenCalledWith({
      name: "Ada",
      email: "ada@example.com",
      company: "Difference Engines",
      monthlyVolume: "1500-5000",
      message: "We make typewriters.",
      source: "pricing-agency",
    });
  });

  it("returns ok but skips Slack when honeypot field is filled", async () => {
    const res = await POST(
      makeReq({
        body: { ...validPayload, website: "spam" },
        ip: "1.1.1.2",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(postContactToSlackMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload (missing email) with 400", async () => {
    const { email: _omit, ...without } = validPayload;
    void _omit;
    const res = await POST(makeReq({ body: without, ip: "1.1.1.3" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_payload" });
    expect(postContactToSlackMock).not.toHaveBeenCalled();
  });

  it("rejects an unparseable JSON body with 400", async () => {
    const res = await POST(makeReq({ body: "{not-json", ip: "1.1.1.4" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
    expect(postContactToSlackMock).not.toHaveBeenCalled();
  });

  it("rate-limits the 4th submission from the same IP within an hour", async () => {
    const ip = "5.5.5.5";
    for (let i = 0; i < 3; i += 1) {
      const ok = await POST(makeReq({ body: validPayload, ip }));
      expect(ok.status).toBe(200);
    }
    const blocked = await POST(makeReq({ body: validPayload, ip }));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited" });
    expect(postContactToSlackMock).toHaveBeenCalledTimes(3);
  });

  it("returns 502 when Slack delivery throws", async () => {
    postContactToSlackMock.mockRejectedValueOnce(new Error("slack down"));
    const res = await POST(makeReq({ body: validPayload, ip: "6.6.6.6" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "delivery_failed" });
  });
});
