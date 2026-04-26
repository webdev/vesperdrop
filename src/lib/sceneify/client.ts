import "server-only";
import { env } from "@/lib/env";
import type { SceneifyGeneration, SceneifyModelId, SceneifyPreset, SceneifySource } from "./types";

export class SceneifyError extends Error {
  constructor(message: string, public status?: number, public body?: string) {
    super(message);
    this.name = "SceneifyError";
  }
}

type Options = { retries?: number; retryDelayMs?: number; timeoutMs?: number };

export class SceneifyClient {
  constructor(private baseUrl: string, private opts: Options = {}) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const retries = this.opts.retries ?? 3;
    const retryDelayMs = this.opts.retryDelayMs ?? 500;
    const timeoutMs = this.opts.timeoutMs ?? 300_000;
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}${path}`, { ...init, signal: ctrl.signal });
        clearTimeout(t);
        if (res.status >= 500) {
          lastError = new SceneifyError(`Sceneify ${res.status}`, res.status, await res.text().catch(() => undefined));
        } else if (!res.ok) {
          throw new SceneifyError(`Sceneify ${res.status}`, res.status, await res.text().catch(() => undefined));
        } else {
          return (await res.json()) as T;
        }
      } catch (e) {
        clearTimeout(t);
        if (e instanceof SceneifyError && e.status && e.status < 500) throw e;
        lastError = e;
      }
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, retryDelayMs * Math.pow(2, attempt)));
      }
    }
    throw lastError instanceof Error ? lastError : new SceneifyError("Unknown sceneify error");
  }

  async listPresets(): Promise<SceneifyPreset[]> {
    const { presets } = await this.request<{ presets: SceneifyPreset[] }>("/api/presets");
    return presets;
  }

  async uploadSource(file: File | Blob, filename: string): Promise<SceneifySource> {
    const form = new FormData();
    form.append("file", file, filename);
    const { source } = await this.request<{ source: SceneifySource }>("/api/sources", { method: "POST", body: form });
    return source;
  }

  async createGeneration(params: { sourceId: string; presetId: string; model: SceneifyModelId }): Promise<SceneifyGeneration> {
    const { generation } = await this.request<{ generation: SceneifyGeneration }>("/api/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    return generation;
  }

  async getGeneration(id: string): Promise<SceneifyGeneration> {
    const { generation } = await this.request<{ generation: SceneifyGeneration }>(`/api/generations/${id}`);
    return generation;
  }
}

let _client: SceneifyClient | null = null;
export function sceneify() {
  if (!_client) _client = new SceneifyClient(env.SCENEIFY_API_URL);
  return _client;
}
