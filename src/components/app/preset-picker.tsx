"use client";
import type { Scene } from "@/lib/db/scenes";

export function PresetPicker({
  scenes,
  value,
  onChange,
}: {
  scenes: Scene[];
  value: string[];
  onChange: (slugs: string[]) => void;
}) {
  function toggle(slug: string) {
    onChange(value.includes(slug) ? value.filter((x) => x !== slug) : [...value, slug]);
  }
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-4">2. Scenes</h2>
      {scenes.length === 0 ? (
        <p className="text-sm text-zinc-500">No scenes available yet.</p>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {scenes.map((s) => {
            const selected = value.includes(s.slug);
            return (
              <li key={s.slug}>
                <button
                  type="button"
                  onClick={() => toggle(s.slug)}
                  className={`block w-full text-left border rounded-lg overflow-hidden transition-colors ${
                    selected
                      ? "border-orange-500 ring-2 ring-orange-500"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.imageUrl}
                    alt={s.name}
                    className="block w-full h-auto"
                  />
                  <div className="p-3">
                    <p className="text-base font-medium text-zinc-900">{s.name}</p>
                    <p className="text-xs text-zinc-500 mt-1 font-mono tracking-wider uppercase">
                      {s.mood}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
