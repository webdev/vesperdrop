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
      <h2 className="font-serif text-2xl mb-4">2. Scenes</h2>
      {scenes.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-3)]">No scenes available yet.</p>
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
                      ? "border-[var(--color-ember)] ring-2 ring-[var(--color-ember)]"
                      : "border-[var(--color-line)]"
                  }`}
                >
                  <div className="aspect-[4/3] bg-[var(--color-paper-2)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt={s.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-serif text-base">{s.name}</p>
                    <p className="text-xs text-[var(--color-ink-3)] mt-1 font-mono tracking-wider uppercase">
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
