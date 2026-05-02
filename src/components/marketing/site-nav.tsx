import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { firstNameFrom } from "@/lib/user-display";

export async function SiteNav() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const firstName = user ? firstNameFrom(user) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-paper/85 backdrop-blur-md">
      <Container width="marketing" className="flex items-center justify-between gap-6 py-4">
        <Link
          href="/"
          className="font-serif text-[22px] font-medium tracking-tight text-ink"
        >
          Vesperdrop
        </Link>

        <nav className="hidden items-center gap-8 text-[14px] text-ink-3 md:flex">
          <Link href="/discover" className="transition-colors hover:text-ink">
            Discover
          </Link>
          <Link href="/#how" className="transition-colors hover:text-ink">
            How it works
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-ink">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {firstName ? (
            <>
              <Link
                href="/account"
                className="hidden text-[14px] text-ink-3 transition-colors hover:text-ink md:inline"
              >
                Hello, {firstName}
              </Link>
              <Link
                href="/app"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-cream transition-colors hover:bg-ink-2"
              >
                Open app <span aria-hidden>→</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden text-[14px] text-ink-3 transition-colors hover:text-ink md:inline"
              >
                Sign in
              </Link>
              <Link
                href="/try"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-cream transition-colors hover:bg-ink-2"
              >
                Try free <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
