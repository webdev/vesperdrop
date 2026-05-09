import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container, type ContainerWidth } from "@/components/ui/container";
import { NavLink } from "@/components/ui/nav-link";
import { firstNameFrom } from "@/lib/user-display";
import { getCreditsBalance } from "@/lib/db/credits";
import { isAdminEmail } from "@/lib/admin";

type NavProps = {
  width?: ContainerWidth;
};

export async function Nav({ width = "app" }: NavProps = {}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = !!user;
  const firstName = user ? firstNameFrom(user) : null;
  const credits = user ? await getCreditsBalance(user.id) : null;
  const email = user?.email ?? "";
  const isAdmin = isAdminEmail(email);

  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-paper/85 backdrop-blur-md">
      <Container
        width={width}
        className="flex items-center gap-10 py-4"
      >
        <Link
          href={isSignedIn ? "/app" : "/"}
          className="font-serif text-[22px] font-medium tracking-tight text-ink"
        >
          Vesperdrop
        </Link>

        <nav
          aria-label="Primary"
          className="hidden flex-1 items-center gap-8 text-[14px] text-ink-3 md:flex"
        >
          <NavLink href="/discover">Discover</NavLink>
          {isSignedIn ? (
            <>
              <NavLink href="/app/library">Library</NavLink>
              <NavLink href="/app" exact matchPrefixes={["/app/runs"]}>
                Styles
              </NavLink>
              <NavLink href="/account">Account</NavLink>
              {isAdmin ? (
                <>
                  <NavLink href="/admin/etsy-candidates">Etsy</NavLink>
                  <NavLink href="/admin/previews">Previews</NavLink>
                </>
              ) : null}
            </>
          ) : (
            <Link
              href="/#how"
              className="py-1 text-ink-3 transition-colors hover:text-ink"
            >
              How it works
            </Link>
          )}
          <NavLink href="/pricing">Pricing</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isSignedIn ? (
            <>
              {typeof credits === "number" ? (
                <span
                  aria-label={`${credits} credits remaining`}
                  className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2 md:inline-flex"
                >
                  Credits
                  <span className="text-ink">{credits}</span>
                </span>
              ) : null}
              <Link
                href="/account"
                className="hidden py-1 text-[14px] text-ink-3 transition-colors hover:text-ink md:inline"
                title={email}
              >
                {firstName ?? email}
              </Link>
              <form
                action="/api/auth/sign-out"
                method="post"
                className="hidden md:block"
              >
                <button
                  type="submit"
                  className="py-1 text-[14px] text-ink-3 transition-colors hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden py-1 text-[14px] text-ink-3 transition-colors hover:text-ink md:inline"
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
