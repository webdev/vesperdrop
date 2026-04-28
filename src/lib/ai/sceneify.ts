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
