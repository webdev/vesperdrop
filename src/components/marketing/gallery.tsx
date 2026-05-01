/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { sceneify } from "@/lib/sceneify/client";
import type { SceneifyPublicPreset } from "@/lib/sceneify/types";

const TONES = [
  "from-zinc-100 to-zinc-50",
  "from-orange-50 to-amber-50",
  "from-rose-50 to-pink-50",
  "from-emerald-50 to-teal-50",
  "from-sky-50 to-indigo-50",
  "from-violet-50 to-fuchsia-50",
  "from-stone-100 to-neutral-50",
  "from-yellow-50 to-orange-50",
];

export async function Gallery() {
  let presets: SceneifyPublicPreset[] = [];
  try {
    presets = await sceneify().listPublicPresets();
  } catch {
    presets = [];
  }
  const ordered = [...presets].sort((a, b) => a.displayOrder - b.displayOrder).slice(0, 8);

  return (
    <section
      id="use-cases"
      className="relative border-y border-zinc-100 bg-zinc-50/60 py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="mb-14 flex flex-col items-start justify-between gap-6 md:mb-20 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
              The scene library
            </p>
            <h2 className="mt-3 text-[clamp(32px,4.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.02em] text-zinc-900">
              {ordered.length} scenes,
              <br />
              <span className="text-zinc-600">tested for conversion.</span>
            </h2>
          </div>
          <Link
            href="/try"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-[14px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            Try them on your photo <span aria-hidden>→</span>
          </Link>
        </div>

        {ordered.length === 0 ? (
          <p className="text-center text-[14px] text-zinc-500">
            Scenes loading. Refresh in a moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {ordered.map((preset, i) => (
              <article
                key={preset.slug}
                className="group relative overflow-hidden rounded-[20px] border border-zinc-200 bg-white p-5 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(15,15,15,0.18)]"
              >
                <div
                  className={`relative aspect-[4/5] overflow-hidden rounded-[12px] bg-gradient-to-br ${
                    TONES[i % TONES.length]
                  }`}
                >
                  {preset.heroImageUrl ? (
                    <img
                      src={preset.heroImageUrl}
                      alt={preset.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : null}
                </div>
                <div className="mt-4">
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                    {preset.category || preset.mood}
                  </span>
                  <h3 className="mt-1.5 text-[20px] font-semibold tracking-tight text-zinc-900">
                    {preset.name}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[14px] leading-[1.5] text-zinc-600">
                    {preset.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
