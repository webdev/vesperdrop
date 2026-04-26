export type SceneifySource = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  createdAt: string;
};

export type SceneifyPreset = {
  id: string;
  name: string;
  description?: string;
  referenceImageUrls: string[];
};

export type SceneifyGenerationStatus = "pending" | "running" | "succeeded" | "failed";

export type SceneifyGeneration = {
  id: string;
  sourceId: string;
  presetId: string;
  model: string;
  status: SceneifyGenerationStatus;
  constructedPrompt?: string;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
};

export type SceneifyModelId = "gpt-image-2" | "nano-banana-2";
