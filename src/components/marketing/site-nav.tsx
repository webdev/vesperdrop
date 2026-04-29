import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstNameFrom } from "@/lib/user-display";

export async function SiteNav() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const firstName = user ? firstNameFrom(user) : null;

  return (
    <header className="border-b border-[var(--color-ink)] bg-[var(--color-paper)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-6 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-3)] md:px-8">
        <span className="hidden sm:inline">THU &middot; APRIL &middot; 25 &middot; MMXXVI</span>
        <span className="text-center">LIFESTYLE PHOTOGRAPHY &middot; GENERATED &middot; ON DEMAND</span>
        <span className="hidden sm:inline">VOL&middot;02 &middot; NO&middot;14</span>
      </div>

      <div className="grid grid-cols-1 items-center gap-6 px-6 py-5 md:grid-cols-[1fr_auto_1fr] md:px-8">
        <nav className="hidden items-center gap-6 md:flex">
          <a
            href="#how"
            className="text-sm text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ember)]"
          >
            How it works
          </a>
          <a
            href="#gallery"
            className="text-sm text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ember)]"
          >
            Gallery
          </a>
          <Link
            href="/pricing"
            className="text-sm text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ember)]"
          >
            Pricing
          </Link>
        </nav>

        <div className="text-center">
          <Link
            href="/"
            className="block font-serif text-4xl font-light italic leading-none tracking-tight text-[var(--color-ink)] md:text-5xl"
          >
            Verceldrop
          </Link>
          <div className="mt-2 font-mono text-[9px] tracking-[0.3em] text-[var(--color-ink-3)]">
            &mdash; EST. 2026 &middot; BROOKLYN NY &mdash;
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {firstName ? (
            <>
              <Link
                href="/account"
                className="text-sm text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ember)]"
              >
                Hello, {firstName}
              </Link>
              <form action="/api/auth/sign-out" method="post">
                <button
                  type="submit"
                  className="text-sm text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-ember)]"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="text-sm text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ember)]"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/try"
            className="inline-flex items-center rounded-full bg-[var(--color-ember)] px-4 py-2 text-xs font-medium tracking-[0.06em] text-[var(--color-cream)] transition-transform hover:scale-[1.04] hover:bg-[#a83c18]"
          >
            Try it &rarr;
          </Link>
        </div>
      </div>
    </header>
  );
}
