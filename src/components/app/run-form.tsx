"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Scene } from "@/lib/db/scenes";
import { UploadDropzone } from "./upload-dropzone";
import { PresetPicker } from "./preset-picker";
import { Button } from "@/components/ui/button";

export function RunForm({
  scenes,
  initialSceneIds = [],
}: {
  scenes: Scene[];
  initialSceneIds?: string[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [sceneIds, setSceneIds] = useState<string[]>(initialSceneIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    start(async () => {
      const form = new FormData();
      for (const f of files) form.append("files", f, f.name);
      for (const id of sceneIds) form.append("presetIds", id);
      const res = await fetch("/api/runs", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Surface credit-out error more helpfully
        if (res.status === 402) {
          setError("You're out of credits. Upgrade your plan or purchase a credit pack.");
        } else {
          setError(body.error ?? `HTTP ${res.status}`);
        }
        return;
      }
      const { runId } = await res.json();
      router.push(`/app/runs/${runId}`);
    });
  }

  const total = files.length * sceneIds.length;
  return (
    <div className="space-y-8">
      <UploadDropzone onChange={setFiles} files={files} />
      <PresetPicker scenes={scenes} value={sceneIds} onChange={setSceneIds} />
      {error && (
        <div className="rounded border border-[var(--color-ember)]/40 bg-[var(--color-ember)]/5 px-4 py-3 text-sm text-[var(--color-ember)]">
          {error}
          {error.includes("credits") && (
            <a href="/pricing" className="ml-2 underline underline-offset-4">
              View plans →
            </a>
          )}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-6">
        <p className="text-sm text-[var(--color-ink-3)]">
          {files.length} photo{files.length === 1 ? "" : "s"} ×{" "}
          {sceneIds.length} scene{sceneIds.length === 1 ? "" : "s"} ={" "}
          <strong>{total}</strong>{" "}
          {total === 1 ? "credit" : "credits"}
        </p>
        <Button
          disabled={!files.length || !sceneIds.length || pending}
          onClick={submit}
        >
          {pending ? "Starting…" : `Generate${total > 0 ? ` · ${total} credit${total === 1 ? "" : "s"}` : ""}`}
        </Button>
      </div>
    </div>
  );
}
