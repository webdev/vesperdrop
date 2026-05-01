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
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 md:px-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-zinc-900"
        >
          <span aria-hidden className="inline-block h-6 w-6 rounded-full bg-zinc-900" />
          Vesperdrop
        </Link>

        <nav className="hidden items-center gap-8 text-[14px] text-zinc-600 md:flex">
          <Link href="/#use-cases" className="hover:text-zinc-900">
            Use cases
          </Link>
          <Link href="/#how" className="hover:text-zinc-900">
            How it works
          </Link>
          <Link href="/pricing" className="hover:text-zinc-900">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {firstName ? (
            <>
              <Link
                href="/account"
                className="hidden text-[14px] text-zinc-600 hover:text-zinc-900 md:inline"
              >
                Hello, {firstName}
              </Link>
              <form action="/api/auth/sign-out" method="post">
                <button
                  type="submit"
                  className="hidden text-[14px] text-zinc-500 hover:text-zinc-900 md:inline"
                >
                  Sign out
                </button>
              </form>
              <Link
                href="/app"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Open app <span aria-hidden>→</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden text-[14px] text-zinc-600 hover:text-zinc-900 md:inline"
              >
                Sign in
              </Link>
              <Link
                href="/try"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Try free <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
