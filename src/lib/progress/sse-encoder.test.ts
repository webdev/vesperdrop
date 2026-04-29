import { describe, it, expect } from "vitest";
import { encodeSse } from "./sse-encoder";

describe("encodeSse", () => {
  it("formats event + data with terminating blank line", () => {
    const out = encodeSse("ready", { startedAt: 1714435200000 });
    expect(new TextDecoder().decode(out)).toBe(
      'event: ready\ndata: {"startedAt":1714435200000}\n\n',
    );
  });

  it("returns Uint8Array", () => {
    const out = encodeSse("tick", { elapsedMs: 0 });
    expect(out).toBeInstanceOf(Uint8Array);
  });

  it("rejects payloads that would break framing", () => {
    expect(() => encodeSse("x", { bad: "a\n\nb" })).toThrow(/framing/i);
  });

  it("handles null payload as empty data", () => {
    const out = encodeSse("done", null);
    expect(new TextDecoder().decode(out)).toBe("event: done\ndata: null\n\n");
  });
});
