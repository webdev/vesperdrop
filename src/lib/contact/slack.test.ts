import { describe, it, expect, vi, beforeEach } from "vitest";
import { postContactToSlack } from "./slack";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("@/lib/env", () => ({
  env: { CONTACT_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/X" },
}));

describe("postContactToSlack", () => {
  beforeEach(() => fetchMock.mockReset());

  it("posts a formatted message to the webhook URL", async () => {
    fetchMock.mockResolvedValue({ ok: true } as Response);
    await postContactToSlack({
      name: "Ada",
      email: "ada@example.com",
      company: "Difference Engines",
      monthlyVolume: "1500-5000",
      message: "We make typewriters.",
      source: "pricing-agency",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T/B/X",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Ada"),
      }),
    );
  });

  it("includes the message block when message is present", async () => {
    fetchMock.mockResolvedValue({ ok: true } as Response);
    await postContactToSlack({
      name: "Ada",
      email: "ada@example.com",
      company: "Difference Engines",
      monthlyVolume: "1500-5000",
      message: "We make typewriters.",
      source: "pricing-agency",
    });
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const text = JSON.stringify(body);
    expect(text).toContain("We make typewriters.");
    expect(text).toContain("pricing-agency");
  });

  it("throws when the webhook responds non-ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(
      postContactToSlack({
        name: "A",
        email: "a@b.co",
        company: "C",
        monthlyVolume: "<500",
        message: null,
        source: "pricing-custom",
      }),
    ).rejects.toThrow(/Slack webhook failed/);
  });

  it("throws when webhook URL is not configured", async () => {
    vi.doMock("@/lib/env", () => ({ env: { CONTACT_SLACK_WEBHOOK_URL: undefined } }));
    vi.resetModules();
    const { postContactToSlack: fresh } = await import("./slack");
    await expect(
      fresh({
        name: "A",
        email: "a@b.co",
        company: "C",
        monthlyVolume: "<500",
        message: null,
        source: "pricing-custom",
      }),
    ).rejects.toThrow(/CONTACT_SLACK_WEBHOOK_URL/);
  });
});
