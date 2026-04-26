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
      <h2 className="font-serif text-2xl mb-4">1. Photos</h2>
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
            ? "border-[var(--color-ember)] bg-[var(--color-ember-soft)]/10"
            : "border-[var(--color-line)] bg-[var(--color-paper-2)]"
        }`}
      >
        <p className="text-sm text-[var(--color-ink-3)]">
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
              className="relative aspect-square border border-[var(--color-line)] overflow-hidden"
            >
              <img
                src={URL.createObjectURL(f)}
                alt={f.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${f.name}`}
                className="absolute top-1 right-1 bg-[var(--color-ink)]/70 text-[var(--color-cream)] text-xs px-2 py-1 rounded"
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
