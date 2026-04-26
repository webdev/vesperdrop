import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[var(--color-paper-3)] text-[var(--color-ink-3)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 font-mono text-[10px] uppercase tracking-[0.18em] sm:flex-row">
        <span>&copy; Darkroom &middot; MMXXVI</span>
        <nav className="flex items-center gap-6">
          <Link
            href="/pricing"
            className="transition-colors hover:text-[var(--color-ink)]"
          >
            Pricing
          </Link>
          <Link
            href="/sign-in"
            className="transition-colors hover:text-[var(--color-ink)]"
          >
            Sign in
          </Link>
        </nav>
        <span>Set in Newsreader &amp; Geist</span>
      </div>
    </footer>
  );
}
