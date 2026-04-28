import "server-only";
import { env } from "@/lib/env";

const QUEUE_BASE = "https://queue.fal.run";

export type FalImageResult = {
  images: Array<{ url: string; width: number; height: number; content_type: string }>;
  seed?: number;
};

type FalQueueStatus = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
};

type FalInput = Record<string, unknown>;

function authHeaders(key: string) {
  return {
    "Authorization": `Key ${key}`,
    "Content-Type": "application/json",
  } as const;
}

async function falFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fal.ai ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

/**
 * Submit to the fal.ai queue and poll until complete.
 * Used for all models (Flux Dev and Flux Pro are queue-based).
 */
export async function falQueue(
  modelId: string,
  input: FalInput,
  timeoutMs = 180_000,
): Promise<FalImageResult> {
  const key = env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set");
  const h = authHeaders(key);

  // Submit job
  const submitRes = await falFetch(`${QUEUE_BASE}/${modelId}`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ input }),
  });
  const { request_id } = (await submitRes.json()) as { request_id: string };

  const statusUrl = `${QUEUE_BASE}/${modelId}/requests/${request_id}/status`;
  const resultUrl = `${QUEUE_BASE}/${modelId}/requests/${request_id}`;
  const deadline = Date.now() + timeoutMs;

  // Poll
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await falFetch(statusUrl, { headers: h });
    const { status } = (await s.json()) as FalQueueStatus;
    if (status === "COMPLETED") {
      const r = await falFetch(resultUrl, { headers: h });
      return (await r.json()) as FalImageResult;
    }
    if (status === "FAILED") throw new Error(`fal.ai generation failed (${modelId})`);
  }
  throw new Error(`fal.ai timed out after ${timeoutMs}ms (${modelId})`);
}
