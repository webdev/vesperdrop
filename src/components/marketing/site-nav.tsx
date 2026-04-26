import Link from "next/link";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-paper)]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-serif text-2xl italic font-light tracking-tight text-[var(--color-ink)]"
        >
          Darkroom
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#how-it-works"
            className="text-sm text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
          >
            How it works
          </a>
          <Link
            href="/pricing"
            className="text-sm text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
          >
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)]"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-cream)] transition-colors hover:bg-[var(--color-ink-2)]"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
