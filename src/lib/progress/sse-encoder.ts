const encoder = new TextEncoder();

function containsDoubleNewline(value: unknown): boolean {
  if (typeof value === "string") {
    return value.includes("\n\n");
  }
  if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) {
      if (containsDoubleNewline(v)) {
        return true;
      }
    }
  }
  return false;
}

export function encodeSse(event: string, data: unknown): Uint8Array {
  if (containsDoubleNewline(data)) {
    throw new Error(
      "encodeSse: payload contains \\n\\n which would break SSE framing",
    );
  }
  const json = JSON.stringify(data);
  return encoder.encode(`event: ${event}\ndata: ${json}\n\n`);
}
