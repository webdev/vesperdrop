type Handler = (event: string, data: unknown) => void;

export function createSseParser(onEvent: Handler) {
  const decoder = new TextDecoder();
  let buffer = "";

  return {
    feed(chunk: Uint8Array) {
      buffer += decoder.decode(chunk, { stream: true });
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        dispatch(frame);
        sep = buffer.indexOf("\n\n");
      }
    },
  };

  function dispatch(frame: string) {
    let event: string | null = null;
    let dataLine: string | null = null;
    for (const line of frame.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) dataLine = line.slice(6);
    }
    if (event === null || dataLine === null) return;
    let data: unknown;
    try {
      data = JSON.parse(dataLine);
    } catch {
      return;
    }
    onEvent(event, data);
  }
}
