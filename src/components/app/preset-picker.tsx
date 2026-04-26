"use client";
import type { SceneifyPreset } from "@/lib/sceneify/types";

export function PresetPicker({
  presets,
  value,
  onChange,
}: {
  presets: SceneifyPreset[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }
  return (
    <section>
      <h2 className="font-serif text-2xl mb-4">2. Presets</h2>
      {presets.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-3)]">No presets available yet.</p>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {presets.map((p) => {
            const selected = value.includes(p.id);
            const thumb = p.referenceImageUrls[0];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`block w-full text-left border rounded-lg overflow-hidden transition-colors ${
                    selected
                      ? "border-[var(--color-ember)] ring-2 ring-[var(--color-ember)]"
                      : "border-[var(--color-line)]"
                  }`}
                >
                  <div className="aspect-[4/3] bg-[var(--color-paper-2)]">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-3">
                    <p className="font-serif text-base">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-[var(--color-ink-3)] mt-1">
                        {p.description}
                      </p>
                    )}
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
