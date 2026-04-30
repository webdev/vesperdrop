import { describe, it, expect, vi } from "vitest";
import { createSseParser } from "./sse-parser";

const enc = (s: string) => new TextEncoder().encode(s);

describe("createSseParser", () => {
  it("parses a complete frame in one chunk", () => {
    const onEvent = vi.fn();
    const p = createSseParser(onEvent);
    p.feed(enc('event: ready\ndata: {"a":1}\n\n'));
    expect(onEvent).toHaveBeenCalledWith("ready", { a: 1 });
  });

  it("buffers across chunks split mid-frame", () => {
    const onEvent = vi.fn();
    const p = createSseParser(onEvent);
    p.feed(enc("event: tick\ndata: "));
    p.feed(enc('{"elapsedMs":42}\n\n'));
    expect(onEvent).toHaveBeenCalledWith("tick", { elapsedMs: 42 });
  });

  it("dispatches multiple frames in one chunk", () => {
    const onEvent = vi.fn();
    const p = createSseParser(onEvent);
    p.feed(enc('event: a\ndata: 1\n\nevent: b\ndata: 2\n\n'));
    expect(onEvent).toHaveBeenNthCalledWith(1, "a", 1);
    expect(onEvent).toHaveBeenNthCalledWith(2, "b", 2);
  });

  it("handles UTF-8 multi-byte characters split across chunks", () => {
    const onEvent = vi.fn();
    const p = createSseParser(onEvent);
    const full = 'event: x\ndata: {"s":"café"}\n\n';
    const bytes = new TextEncoder().encode(full);
    p.feed(bytes.slice(0, 24));
    p.feed(bytes.slice(24));
    expect(onEvent).toHaveBeenCalledWith("x", { s: "café" });
  });

  it("ignores frames missing event or data", () => {
    const onEvent = vi.fn();
    const p = createSseParser(onEvent);
    p.feed(enc("data: only\n\n"));
    p.feed(enc("event: only\n\n"));
    expect(onEvent).not.toHaveBeenCalled();
  });
});
