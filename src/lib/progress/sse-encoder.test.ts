import { describe, it, expect } from "vitest";
import { encodeSse } from "./sse-encoder";

describe("encodeSse", () => {
  it("formats event + data with terminating blank line", () => {
    const out = encodeSse("ready", { startedAt: 1714435200000 });
    expect(new TextDecoder().decode(out)).toBe(
      'event: ready\ndata: {"startedAt":1714435200000}\n\n',
    );
  });

  it("returns a Uint8Array", () => {
    const out = encodeSse("tick", { elapsedMs: 0 });
    expect(out.constructor.name).toBe("Uint8Array");
  });

  it("handles null payload as the literal JSON null", () => {
    const out = encodeSse("done", null);
    expect(new TextDecoder().decode(out)).toBe("event: done\ndata: null\n\n");
  });

  it("escapes embedded newlines safely so framing never breaks", () => {
    const out = encodeSse("x", { bad: "a\n\nb" });
    const decoded = new TextDecoder().decode(out);
    // JSON.stringify escapes \n as the two-char \\n, so the decoded SSE bytes
    // contain exactly one trailing \n\n (the SSE frame terminator) and no
    // earlier \n\n that would split the frame.
    expect(decoded.endsWith("\n\n")).toBe(true);
    expect(decoded.slice(0, -2).includes("\n\n")).toBe(false);
  });
});
