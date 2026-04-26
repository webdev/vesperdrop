import Link from "next/link";

type Props = {
  eyebrow: string;
  headline: React.ReactNode;
  ctaLabel: string;
  ctaHref: string;
  tone?: "ink" | "cream";
  caption?: string;
};

export function CtaBand({
  eyebrow,
  headline,
  ctaLabel,
  ctaHref,
  tone = "cream",
  caption,
}: Props) {
  const isInk = tone === "ink";
  const sectionClass = isInk
    ? "border-b border-[var(--color-ink)] bg-[var(--color-ink)]"
    : "border-b border-[var(--color-ink)] bg-[var(--color-cream)]";
  const eyebrowClass = isInk
    ? "font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-cream)]/60"
    : "font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-3)]";
  const headlineClass = isInk
    ? "font-serif text-[clamp(36px,5vw,52px)] font-light leading-[1.05] tracking-tight text-[var(--color-cream)]"
    : "font-serif text-[clamp(36px,5vw,52px)] font-light leading-[1.05] tracking-tight text-[var(--color-ink)]";
  const captionClass = isInk
    ? "mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-cream)]/60"
    : "mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-3)]";

  return (
    <section className={sectionClass}>
      <div className="grid grid-cols-1 items-center gap-8 px-6 py-12 md:grid-cols-[1.4fr_1fr] md:gap-12 md:px-12 md:py-16">
        <div>
          <p className={eyebrowClass}>{eyebrow}</p>
          <h2 className={`mt-3 ${headlineClass} [&_em]:italic [&_em]:text-[var(--color-ember)]`}>
            {headline}
          </h2>
        </div>
        <div className="flex flex-col items-start md:items-end">
          <Link
            href={ctaHref}
            className="inline-flex items-center rounded-full bg-[var(--color-ember)] px-7 py-4 text-sm md:text-base font-medium text-[var(--color-cream)] transition-transform hover:scale-[1.02] hover:bg-[#a83c18]"
          >
            {ctaLabel} &rarr;
          </Link>
          {caption ? <div className={captionClass}>{caption}</div> : null}
        </div>
      </div>
    </section>
  );
}
