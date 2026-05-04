// Editorial break inserted between batch rows on the library to create
// rhythm and avoid the row → row → row repetition. Three variants
// rotate deterministically by index. No data dependency — copy lives
// alongside the component for now; can be moved to a CMS later.

import Link from "next/link";

type StripVariant = "quote" | "spotlight" | "field-note";

interface Props {
  /** Deterministic — same row position renders the same variant. */
  index: number;
}

const QUOTES = [
  {
    text: "Great product photography isn't shot. It's composed.",
    attribution: "On craft",
  },
  {
    text: "The frame begins where the eye stops.",
    attribution: "On framing",
  },
  {
    text: "Light is the first stylist.",
    attribution: "On lighting",
  },
];

const SPOTLIGHTS = [
  {
    label: "Style spotlight",
    title: "Cozy interiors, slow afternoons",
    body: "Soft window light, warm woods, and a single garment in soft focus. The cozy-indoor preset leans into texture and stillness — best for knits, loungewear, and natural fibers.",
  },
  {
    label: "Style spotlight",
    title: "Golden hour, soft horizons",
    body: "Backlit silhouettes, hair-light haloes, and shallow depth. The golden-field preset frames the subject against open sky — best for flowing fabrics and outerwear.",
  },
  {
    label: "Style spotlight",
    title: "Studio whites, clean truth",
    body: "Crisp seamless backgrounds, even key light, and sharp shadow lines. The studio-white preset is the catalog standard — best for color accuracy and detail crops.",
  },
];

const FIELD_NOTES = [
  {
    label: "Field note",
    title: "From source to scene",
    body: "Vesperdrop reads your product photo, plans a lighting and styling brief, then renders the result at native HD. Most batches finish in under a minute.",
  },
  {
    label: "Field note",
    title: "Styles, on tap",
    body: "Every batch you make can become a recipe — reuse the look on a new product anytime, or generate a coordinated marketplace pack with one click.",
  },
];

function pickVariant(index: number): StripVariant {
  // Three-way rotation: quote → spotlight → field-note.
  const variants: StripVariant[] = ["quote", "spotlight", "field-note"];
  return variants[index % variants.length]!;
}

export function LibraryEditorialStrip({ index }: Props) {
  const variant = pickVariant(index);

  if (variant === "quote") {
    const q = QUOTES[index % QUOTES.length]!;
    return (
      <aside className="flex flex-col items-center py-12 text-center md:py-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
          {q.attribution}
        </p>
        <blockquote className="mt-5 max-w-[640px] font-serif text-[clamp(1.625rem,2.6vw,2.25rem)] leading-[1.2] tracking-[-0.015em] text-ink">
          &ldquo;{q.text}&rdquo;
        </blockquote>
      </aside>
    );
  }

  if (variant === "spotlight") {
    const s = SPOTLIGHTS[index % SPOTLIGHTS.length]!;
    return (
      <aside className="flex flex-col gap-5 border-y border-line-soft py-10 md:flex-row md:items-baseline md:gap-12 md:py-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta md:w-[180px] md:shrink-0">
          {s.label}
        </p>
        <div className="max-w-[620px]">
          <h2 className="font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.2] tracking-[-0.01em] text-ink">
            {s.title}
          </h2>
          <p className="mt-3 text-[14px] leading-[1.6] text-ink-3">{s.body}</p>
        </div>
      </aside>
    );
  }

  // field-note
  const n = FIELD_NOTES[index % FIELD_NOTES.length]!;
  return (
    <aside className="flex flex-col gap-4 py-10 md:py-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
        {n.label}
      </p>
      <h2 className="max-w-[560px] font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.2] tracking-[-0.01em] text-ink">
        {n.title}
      </h2>
      <p className="max-w-[560px] text-[14px] leading-[1.6] text-ink-3">
        {n.body}
      </p>
      <Link
        href="/discover"
        className="mt-2 inline-flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink"
      >
        Explore styles <span aria-hidden>→</span>
      </Link>
    </aside>
  );
}
