/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const SCENES = [
  {
    slug: "studio_athletic",
    name: "Studio Athletic",
    mood: "STUDIO · SOFT STROBE",
    category: "STUDIO",
    palette: ["#f4f0e8", "#c2a37a", "#8a6f4d", "#3d3025", "#1b1915"],
  },
  {
    slug: "leather_noir",
    name: "Leather Noir",
    mood: "INTERIOR · LOW KEY TUNGSTEN",
    category: "INTERIOR",
    palette: ["#2a2018", "#5d4632", "#a87b4f", "#d6b380", "#1b1915"],
  },
  {
    slug: "graffiti_alley",
    name: "Graffiti Alley",
    mood: "ALLEY · BOUNCED DAYLIGHT",
    category: "STREET",
    palette: ["#3a4d4a", "#7e8a6e", "#c2a047", "#d65f3f", "#1f1f1d"],
  },
  {
    slug: "mono_street",
    name: "Mono Street",
    mood: "STREET · OVERCAST CONCRETE",
    category: "STREET",
    palette: ["#cfcdc8", "#9a958d", "#5e5a52", "#2f2c27", "#1b1915"],
  },
  {
    slug: "shutter_crew",
    name: "Shutter Crew",
    mood: "ROLLUP DOORS · MORNING SUN",
    category: "EXTERIOR",
    palette: ["#e8d8b6", "#c79755", "#6f4a2a", "#392418", "#0f0c08"],
  },
];

const TOP = SCENES[0];
const NEXT_1 = SCENES[1];
const NEXT_2 = SCENES[2];

export function Discover() {
  return (
    <section id="discover" className="border-b border-[var(--color-ink)]">
      <div className="grid grid-cols-1 border-b border-[var(--color-line)] md:grid-cols-[240px_1fr]">
        <div className="border-b border-[var(--color-line)] px-6 py-8 md:border-r md:border-b-0 md:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            STYLE DISCOVERY &middot; N&deg;02&middot;5
          </p>
        </div>
        <div className="px-6 py-8 md:px-12">
          <h2 className="font-serif text-5xl font-light leading-[1.02] tracking-tight text-[var(--color-ink)] md:text-[72px]">
            Train your <span className="italic">eye</span>.
          </h2>
          <p className="mt-4 max-w-xl font-serif text-lg font-light leading-snug text-[var(--color-ink-2)]">
            Swipe through a deck of curated lighting and locations. Save the
            looks you&apos;d buy &mdash; we blend the lighting, palette, and
            mood into every shot you generate.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-[1fr_440px] md:gap-16 md:px-12 md:py-24">
        <div className="order-2 md:order-1">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            HOW IT WORKS
          </p>
          <ol className="space-y-4 font-serif text-xl font-light leading-snug text-[var(--color-ink)]">
            <li className="flex gap-4">
              <span className="font-serif text-2xl italic text-[var(--color-ember)]">
                I.
              </span>
              <span>
                A stack of reference shots fans across the deck.
              </span>
            </li>
            <li className="flex gap-4">
              <span className="font-serif text-2xl italic text-[var(--color-ember)]">
                II.
              </span>
              <span>
                Swipe right on the looks that speak to you. Skip the rest.
              </span>
            </li>
            <li className="flex gap-4">
              <span className="font-serif text-2xl italic text-[var(--color-ember)]">
                III.
              </span>
              <span>
                Your moodboard becomes the recipe for every generated photo.
              </span>
            </li>
          </ol>

          <div className="mt-10 flex items-center gap-6">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 bg-[var(--color-ember)] px-6 py-3 font-mono text-xs tracking-[0.18em] text-white uppercase transition-opacity hover:opacity-90"
            >
              Try the deck &rarr;
            </Link>
            <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--color-ink-3)] uppercase">
              ← Skip &middot; Save →
            </span>
          </div>
        </div>

        <div className="order-1 mx-auto w-full max-w-[420px] md:order-2">
          <div className="relative aspect-[4/5]">
            {[NEXT_2, NEXT_1, TOP].map((card, idx) => {
              const isTop = idx === 2;
              const offset = 2 - idx;
              const ty = offset * 14;
              const scale = 1 - offset * 0.04;
              const rotate = isTop ? -3 : 0;
              return (
                <div
                  key={card.slug}
                  className={`absolute inset-0 overflow-hidden border border-[var(--color-line)] bg-[var(--color-cream)] ${
                    isTop
                      ? "shadow-[0_18px_50px_rgba(27,25,21,0.22)]"
                      : "shadow-[0_8px_22px_rgba(27,25,21,0.10)]"
                  }`}
                  style={{
                    transform: `translateY(${ty}px) scale(${scale}) rotate(${rotate}deg)`,
                    transition: "transform 0.3s cubic-bezier(0.2,0.8,0.2,1)",
                  }}
                >
                  <img
                    src={`/marketing/styles/${card.slug}.jpg`}
                    alt={card.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/75" />

                  <div className="absolute top-4 left-4 bg-black/55 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--color-cream)] backdrop-blur-sm">
                    REF_
                    {String(SCENES.findIndex((s) => s.slug === card.slug) + 1).padStart(3, "0")}
                    {" · "}
                    {card.category}
                  </div>

                  {isTop && (
                    <div
                      className="absolute top-8 left-6 rotate-[-12deg] border-[3px] border-[var(--color-ember)] bg-[var(--color-cream)]/85 px-3.5 py-2 font-mono text-xl font-bold tracking-[0.18em] text-[var(--color-ember)]"
                      aria-hidden="true"
                    >
                      SAVE
                    </div>
                  )}

                  <div className="absolute right-0 bottom-0 left-0 px-5 pt-12 pb-5 text-[var(--color-cream)]">
                    <h3 className="font-serif text-3xl font-light italic">
                      {card.name}
                    </h3>
                    <p className="mt-2 font-mono text-[10px] tracking-[0.14em] opacity-85">
                      {card.mood}
                    </p>
                    <div className="mt-3 flex h-1.5">
                      {card.palette.map((c, i) => (
                        <div
                          key={i}
                          className="flex-1"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex gap-1">
            {SCENES.map((_, i) => (
              <div
                key={i}
                className={`h-[2px] flex-1 ${
                  i === 0 ? "bg-[var(--color-ember)]" : "bg-[var(--color-line)]"
                }`}
              />
            ))}
          </div>
          <p className="mt-3 text-center font-mono text-[10px] tracking-[0.14em] text-[var(--color-ink-3)] uppercase">
            01 / {String(SCENES.length).padStart(2, "0")} &middot; SCENE DECK
          </p>
        </div>
      </div>
    </section>
  );
}
