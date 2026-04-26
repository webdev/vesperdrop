/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const SCENES = [
  {
    slug: "studio_athletic",
    name: "Studio Athletic",
    caption: "STUDIO · SOFT STROBE",
  },
  {
    slug: "mono_street",
    name: "Mono Street",
    caption: "STREET · OVERCAST CONCRETE",
  },
  {
    slug: "leather_noir",
    name: "Leather Noir",
    caption: "INTERIOR · LOW KEY TUNGSTEN",
  },
  {
    slug: "graffiti_alley",
    name: "Graffiti Alley",
    caption: "ALLEY · BOUNCED DAYLIGHT",
  },
  {
    slug: "shutter_crew",
    name: "Shutter Crew",
    caption: "ROLLUP DOORS · MORNING SUN",
  },
];

export function Discover() {
  return (
    <section id="discover" className="border-b border-[var(--color-ink)]">
      <div className="grid grid-cols-1 border-b border-[var(--color-line)] md:grid-cols-[240px_1fr]">
        <div className="border-b border-[var(--color-line)] px-6 py-8 md:border-r md:border-b-0 md:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            DISCOVER &middot; N&deg;02&middot;5
          </p>
        </div>
        <div className="px-6 py-8 md:px-12">
          <h2 className="font-serif text-5xl font-light leading-[1.02] tracking-tight text-[var(--color-ink)] md:text-[72px]">
            Pick a scene.
            <br />
            <span className="italic">Any scene.</span>
          </h2>
          <p className="mt-4 max-w-xl font-serif text-lg font-light leading-snug text-[var(--color-ink-2)]">
            A growing library of curated lighting and locations &mdash; or
            describe your own in plain English.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3">
        {SCENES.map((scene, i) => {
          const isLastInRowMd = (i + 1) % 3 === 0 || i === SCENES.length - 1;
          const isLastRowMd = i >= Math.floor((SCENES.length - 1) / 3) * 3;
          return (
            <Link
              key={scene.slug}
              href="/sign-up"
              className={`group relative block aspect-[4/5] overflow-hidden bg-[var(--color-ink)] ${
                isLastInRowMd ? "" : "md:border-r md:border-[var(--color-line)]"
              } ${isLastRowMd ? "md:border-b-0" : "md:border-b md:border-[var(--color-line)]"} ${
                i < SCENES.length - 1 ? "border-b border-[var(--color-line)] md:border-b-0" : ""
              } ${i % 2 !== 0 ? "border-l border-[var(--color-line)] md:border-l-0" : ""}`}
            >
            <img
              src={`/marketing/styles/${scene.slug}.jpg`}
              alt={scene.name}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute right-3 left-3 bottom-3 text-[var(--color-cream)]">
              <h3 className="font-serif text-2xl font-light leading-tight md:text-3xl">
                {scene.name}
              </h3>
              <p className="mt-1 font-mono text-[10px] tracking-[0.18em] opacity-80">
                {scene.caption}
              </p>
            </div>
          </Link>
          );
        })}
      </div>
    </section>
  );
}
