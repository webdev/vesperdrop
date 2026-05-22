import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container, type ContainerWidth } from "@/components/ui/container";
import { NavLink } from "@/components/ui/nav-link";
import { firstNameFrom } from "@/lib/user-display";
import { getQuotaBalance } from "@/lib/db/quota";
import { isAdminEmail } from "@/lib/admin";
import { MobileNavSheet } from "@/components/mobile-nav-sheet";

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
  const credits = user ? await getQuotaBalance(user.id) : null;
  const email = user?.email ?? "";
  const isAdmin = isAdminEmail(email);

  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-paper/85 backdrop-blur-md">
      <Container
        width={width}
        className="flex items-center gap-3 py-4 md:gap-10"
      >
        {/* Mobile hamburger — hidden above md */}
        <div className="md:hidden">
          <MobileNavSheet
            isSignedIn={isSignedIn}
            credits={credits}
            isAdmin={isAdmin}
            firstName={firstName}
            email={email}
          />
        </div>

        <Link
          href={isSignedIn ? "/app" : "/"}
          className="font-serif text-[22px] font-medium tracking-tight text-ink"
        >
          Vesperdrop
        </Link>

        {/* Desktop primary nav */}
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
                <NavLink
                  href="/admin/etsy-candidates"
                  matchPrefixes={["/admin"]}
                >
                  Admin
                </NavLink>
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

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {isSignedIn ? (
            <>
              {/* Credit chip — always visible (mobile users need to see this) */}
              {isAdmin ? (
                <span
                  aria-label="Unlimited photos"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2"
                >
                  Photos
                  <span className="text-ink">∞</span>
                </span>
              ) : typeof credits === "number" ? (
                <span
                  aria-label={`${credits} photos remaining`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2"
                >
                  Photos
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
              {/* Sign in hidden on mobile — reachable via sheet */}
              <Link
                href="/sign-in"
                className="hidden py-1 text-[13px] text-ink-3 transition-colors hover:text-ink md:inline md:text-[14px]"
              >
                Sign in
              </Link>
              <Link
                href="/try"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-cream transition-colors hover:bg-ink-2 md:gap-2 md:px-5 md:text-[14px]"
              >
                {/* Short variant on narrowest widths so the CTA never
                    wraps. "First free" is allowed by CLAUDE.md §15a as
                    a short form of "first one's free"; "Try free" was
                    a previous regression and is forbidden. */}
                <span className="sm:hidden">First free</span>
                <span className="hidden sm:inline">First photo free</span>
                <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
