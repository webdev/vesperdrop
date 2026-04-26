"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SceneifyPreset } from "@/lib/sceneify/types";
import { UploadDropzone } from "./upload-dropzone";
import { PresetPicker } from "./preset-picker";
import { Button } from "@/components/ui/button";

export function RunForm({ presets }: { presets: SceneifyPreset[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [presetIds, setPresetIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    start(async () => {
      const form = new FormData();
      for (const f of files) form.append("files", f, f.name);
      for (const id of presetIds) form.append("presetIds", id);
      const res = await fetch("/api/runs", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const { runId } = await res.json();
      router.push(`/app/runs/${runId}`);
    });
  }

  const total = files.length * presetIds.length;
  return (
    <div className="space-y-8">
      <UploadDropzone onChange={setFiles} files={files} />
      <PresetPicker presets={presets} value={presetIds} onChange={setPresetIds} />
      {error && <p className="text-sm text-[var(--color-ember)]">{error}</p>}
      <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-6">
        <p className="text-sm text-[var(--color-ink-3)]">
          {files.length} photo{files.length === 1 ? "" : "s"} × {presetIds.length} preset
          {presetIds.length === 1 ? "" : "s"} = <strong>{total}</strong> images
        </p>
        <Button
          disabled={!files.length || !presetIds.length || pending}
          onClick={submit}
        >
          {pending ? "Starting..." : "Generate"}
        </Button>
      </div>
    </div>
  );
}
