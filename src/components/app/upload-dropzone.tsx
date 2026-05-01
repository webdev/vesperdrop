"use client";
import { useRef, useState } from "react";

export function UploadDropzone({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function add(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    onChange([...files, ...incoming]);
  }

  function removeAt(i: number) {
    const next = files.slice();
    next.splice(i, 1);
    onChange(next);
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-4">1. Photos</h2>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          over
            ? "border-orange-500 bg-orange-50"
            : "border-zinc-300 bg-zinc-50 hover:border-zinc-400"
        }`}
      >
        <p className="text-sm text-zinc-500">
          Drop product photos here or click to browse
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {files.map((f, i) => (
            <li
              key={i}
              className="relative border border-zinc-200 rounded overflow-hidden"
            >
              <img
                src={URL.createObjectURL(f)}
                alt={f.name}
                className="block w-full h-auto"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${f.name}`}
                className="absolute top-1 right-1 bg-zinc-900/70 text-white text-xs px-2 py-1 rounded"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
