import Link from "next/link";

export function ClosingCta() {
  return (
    <section className="border-b border-[var(--color-ink)] px-6 py-28 text-center md:py-36">
      <p className="mb-7 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-3)]">
        COLOPHON &middot; N&deg;05
      </p>
      <h2 className="mx-auto max-w-5xl font-serif text-[clamp(64px,11vw,160px)] font-light leading-[0.95] tracking-tight text-[var(--color-ink)]">
        Get <span className="italic text-[var(--color-ember)]">vesperdrop</span>.
      </h2>
      <Link
        href="/try"
        className="mt-12 inline-flex items-center rounded-full bg-[var(--color-ember)] px-9 py-5 text-base md:text-lg font-medium text-[var(--color-cream)] transition-transform hover:scale-[1.02] hover:bg-[#a83c18]"
      >
        Start with 1 free HD shot &rarr;
      </Link>
      <div className="mt-6 font-mono text-[10px] tracking-[0.2em] text-[var(--color-ink-3)]">
        NO CARD &middot; FIRST RESULT IN ~90S &middot; UPGRADE WHEN YOU SEE IT
      </div>
    </section>
  );
}
