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
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Step 01
      </p>
      <h2 className="mt-2 mb-5 font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.1] tracking-[-0.01em] text-ink">
        Upload photos
      </h2>
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
        className={`cursor-pointer rounded-lg border border-dashed p-10 text-center transition-colors ${
          over
            ? "border-terracotta bg-terracotta-wash/40"
            : "border-line bg-surface hover:border-ink-4"
        }`}
      >
        <p className="text-[14px] text-ink-3">
          Drop product photos here or{" "}
          <span className="text-terracotta underline underline-offset-4">
            click to browse
          </span>
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
          PNG, JPG · multiple files
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
        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {files.map((f, i) => (
            <li
              key={i}
              className="relative overflow-hidden rounded-md border border-line-soft bg-paper-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(f)}
                alt={f.name}
                className="block aspect-[4/5] h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${f.name}`}
                className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 font-mono text-[11px] text-cream transition-colors hover:bg-ink"
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
