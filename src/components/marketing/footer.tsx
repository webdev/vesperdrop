import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[var(--color-paper)] text-[var(--color-ink-3)]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-12 md:grid-cols-3 md:px-8">
        <div>
          <Link
            href="/"
            className="block font-serif text-3xl font-light italic tracking-tight text-[var(--color-ink)]"
          >
            Verceldrop
          </Link>
          <p className="mt-3 max-w-xs font-serif text-base font-light leading-snug text-[var(--color-ink-2)]">
            Lifestyle photography, generated. For sellers who shoot on bedsheets
            and ship like a studio.
          </p>
        </div>

        <div>
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            Product
          </p>
          <ul className="space-y-2 text-sm text-[var(--color-ink-2)]">
            <li>
              <Link href="/pricing" className="hover:text-[var(--color-ember)]">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/sign-in" className="hover:text-[var(--color-ember)]">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/#how" className="hover:text-[var(--color-ember)]">
                How it works
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            &copy; 2026 Verceldrop Studio
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
            verceldrop.com
          </p>
        </div>
      </div>
    </footer>
  );
}
