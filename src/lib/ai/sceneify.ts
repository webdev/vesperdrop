import "server-only";
import { getVercelOidcToken } from "@vercel/oidc";
import { env } from "@/lib/env";

export type SceneifyModelId =
  | "gpt-image-2"
  | "nano-banana-2"
  | "flux-kontext"
  | "flux-2";

export type SceneifyQuality = "low" | "medium" | "high" | "auto";

export type SceneifyGenerateInput = {
  sourceUrl: string;
  sourceFilename?: string;
  sourceMimeType?: string;
  presetSlug: string;
  model: SceneifyModelId;
  sizeProfile?: string;
  quality?: SceneifyQuality;
  seed?: number;
  shotFraming?: string;
  callerRef?: string;
};

export type SceneifyGenerateResult = {
  generationId: string;
  outputUrl: string;
  register?: string;
  model: SceneifyModelId;
  requestedModel?: SceneifyModelId;
  seed?: number;
  colorMaxDeltaE?: number;
  colorAvgDeltaE?: number;
  callerProjectId?: string;
  callerRef?: string;
};

export class SceneifyError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "SceneifyError";
    this.status = status;
    this.detail = detail;
  }
}

export async function generateViaSceneify(
  input: SceneifyGenerateInput,
  init?: { signal?: AbortSignal },
): Promise<SceneifyGenerateResult> {
  const token = await getVercelOidcToken();
  if (!token) {
    throw new SceneifyError(
      "missing Vercel OIDC token (run on Vercel or via `vercel dev`)",
      500,
    );
  }

  const base = env.SCENEIFY_API_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/internal/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: init?.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SceneifyError(
      `sceneify ${res.status}`,
      res.status,
      body.slice(0, 500),
    );
  }

  return (await res.json()) as SceneifyGenerateResult;
}

// ---------------------------------------------------------------------------
// Complete the look — multi-shot listing pack derived from a parent generation.
// ---------------------------------------------------------------------------

export type SceneifyPackPlatform = "amazon" | "shopify" | "instagram" | "tiktok";

export type SceneifyCompleteLookInput = {
  parentGenerationId: string;
  platform: SceneifyPackPlatform;
  model?: SceneifyModelId;
  quality?: SceneifyQuality;
  callerRef?: string;
};

export type SceneifyPackShot = {
  generationId: string;
  role: string;
  label: string;
  shotIndex: number;
  sizeProfile: string;
  status: "pending" | "running" | "succeeded" | "failed";
  outputUrl?: string | null;
  error?: string | null;
  seed?: number;
  colorMaxDeltaE?: number | null;
};

export type SceneifyCompleteLookResult = {
  packId: string;
  parentGenerationId: string;
  platform: SceneifyPackPlatform;
  seed: number;
  model: SceneifyModelId;
  quality: SceneifyQuality;
  statusUrl: string;
  shots: SceneifyPackShot[];
  callerProjectId?: string;
  callerRef?: string;
};

export type SceneifyCompleteLookStatus = {
  packId: string;
  parentGenerationId: string | null;
  platform: SceneifyPackPlatform | null;
  total: number;
  succeeded: number;
  failed: number;
  pending: number;
  done: boolean;
  shots: SceneifyPackShot[];
  callerProjectId?: string;
};

async function bearerToken(): Promise<string> {
  const token = await getVercelOidcToken();
  if (!token) {
    throw new SceneifyError(
      "missing Vercel OIDC token (run on Vercel or via `vercel dev`)",
      500,
    );
  }
  return token;
}

export async function completeLookViaSceneify(
  input: SceneifyCompleteLookInput,
  init?: { signal?: AbortSignal },
): Promise<SceneifyCompleteLookResult> {
  const token = await bearerToken();
  const base = env.SCENEIFY_API_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/internal/complete-look`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: init?.signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SceneifyError(`sceneify ${res.status}`, res.status, body.slice(0, 500));
  }
  return (await res.json()) as SceneifyCompleteLookResult;
}

export async function getCompleteLookStatus(
  packId: string,
  init?: { signal?: AbortSignal },
): Promise<SceneifyCompleteLookStatus> {
  const token = await bearerToken();
  const base = env.SCENEIFY_API_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/internal/complete-look/${encodeURIComponent(packId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: init?.signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SceneifyError(`sceneify ${res.status}`, res.status, body.slice(0, 500));
  }
  return (await res.json()) as SceneifyCompleteLookStatus;
}
