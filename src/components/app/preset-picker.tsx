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
    onChange(
      value.includes(slug) ? value.filter((x) => x !== slug) : [...value, slug],
    );
  }
  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Step 02
      </p>
      <h2 className="mt-2 mb-5 font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.1] tracking-[-0.01em] text-ink">
        Pick scenes
      </h2>
      {scenes.length === 0 ? (
        <p className="text-[14px] text-ink-3">No scenes available yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {scenes.map((s) => {
            const selected = value.includes(s.slug);
            return (
              <li key={s.slug}>
                <button
                  type="button"
                  onClick={() => toggle(s.slug)}
                  className={`group block w-full overflow-hidden rounded-md border text-left transition-colors ${
                    selected
                      ? "border-terracotta ring-2 ring-terracotta"
                      : "border-line-soft hover:border-line"
                  }`}
                  aria-pressed={selected}
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-paper-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt={s.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                    {selected ? (
                      <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta font-mono text-[10px] text-cream">
                        ✓
                      </span>
                    ) : null}
                  </div>
                  <div className="bg-surface p-3">
                    <p className="font-serif text-[16px] leading-[1.2] tracking-[-0.005em] text-ink">
                      {s.name}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
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
