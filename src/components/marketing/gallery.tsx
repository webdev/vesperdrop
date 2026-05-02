/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { sceneify } from "@/lib/sceneify/client";
import type { SceneifyPublicPreset } from "@/lib/sceneify/types";

export async function Gallery() {
  let presets: SceneifyPublicPreset[] = [];
  try {
    presets = await sceneify().listPublicPresets();
  } catch {
    presets = [];
  }
  const ordered = [...presets].sort((a, b) => a.displayOrder - b.displayOrder).slice(0, 8);

  // Editorial spread: first tile dominates, others cluster around it with
  // varied aspect ratios so the gallery reads like a magazine, not a grid.
  // Pattern (8 tiles, 12-col base):
  //   1. wide-portrait hero (5)
  //   2-3. square pair (3 + 4)
  //   4. wide landscape feature (7)
  //   5. tall portrait (5)
  //   6. square (3)  →  pair with #7 (4) and #8 (5)
  const PATTERN: Array<{ span: string; aspect: string }> = [
    { span: "md:col-span-5", aspect: "aspect-[3/4]" },   // hero — dominant
    { span: "md:col-span-3", aspect: "aspect-square" },
    { span: "md:col-span-4", aspect: "aspect-[4/5]" },
    { span: "md:col-span-7", aspect: "aspect-[5/4]" },   // wide landscape
    { span: "md:col-span-5", aspect: "aspect-[3/4]" },   // tall portrait
    { span: "md:col-span-3", aspect: "aspect-square" },
    { span: "md:col-span-4", aspect: "aspect-[4/5]" },
    { span: "md:col-span-5", aspect: "aspect-[5/4]" },
  ];

  return (
    <section id="use-cases" className="border-y border-line-soft bg-paper-soft py-20 md:py-24">
      <Container width="marketing">
        <div className="mb-12 flex flex-col items-end justify-between gap-6 md:mb-16 md:flex-row">
          <div className="md:max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              The scene library
            </p>
            <h2 className="mt-4 font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-ink">
              {ordered.length} scenes,{" "}
              <em className="not-italic font-serif italic text-terracotta-dark">
                tested for conversion.
              </em>
            </h2>
          </div>
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
          >
            Browse the deck <span aria-hidden>→</span>
          </Link>
        </div>

        {ordered.length === 0 ? (
          <p className="text-center text-[14px] text-ink-3">
            Scenes loading. Refresh in a moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-12 md:gap-4">
            {ordered.map((preset, i) => {
              const cell = PATTERN[i % PATTERN.length]!;
              return (
                <article
                  key={preset.slug}
                  className={`group ${cell.span} flex flex-col gap-3`}
                >
                  <div
                    className={`relative ${cell.aspect} overflow-hidden rounded-md border border-line-soft bg-paper-2`}
                  >
                    {preset.heroImageUrl ? (
                      <img
                        src={preset.heroImageUrl}
                        alt={preset.name}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover object-[center_25%] transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
                      {preset.category || preset.mood}
                    </p>
                    <h3 className="mt-1 font-serif text-[18px] leading-[1.15] tracking-[-0.01em] text-ink">
                      {preset.name}
                    </h3>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Container>
    </section>
  );
}
