import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SceneifyClient, SceneifyError } from "../client";

const baseUrl = "http://sceneify.test";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("SceneifyClient", () => {
  it("listPresets returns presets array", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ presets: [{ id: "studio-direct", name: "Studio", referenceImageUrls: [] }] }), { status: 200 }),
    );
    const client = new SceneifyClient(baseUrl);
    const presets = await client.listPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBe("studio-direct");
  });

  it("retries on 5xx and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("oops", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ presets: [] }), { status: 200 }));
    const client = new SceneifyClient(baseUrl, { retryDelayMs: 1 });
    await client.listPresets();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 4xx", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 400 }));
    const client = new SceneifyClient(baseUrl, { retryDelayMs: 1 });
    await expect(client.listPresets()).rejects.toBeInstanceOf(SceneifyError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
