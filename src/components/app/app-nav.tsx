import Link from "next/link";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

type AppNavProps = {
  firstName: string | null;
  email: string;
  credits?: number | null;
  active?: "discover" | "library" | "styles" | "account" | null;
};

const SIGNED_IN_LINKS: Array<{ href: string; label: string; key: AppNavProps["active"] }> = [
  { href: "/discover", label: "Discover", key: "discover" },
  { href: "/app/library", label: "Library", key: "library" },
  { href: "/app", label: "Styles", key: "styles" },
  { href: "/account", label: "Account", key: "account" },
];

export function AppNav({ firstName, email, credits, active }: AppNavProps) {
  const isSignedIn = email.length > 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <Container width="app" className="flex items-center justify-between gap-6 py-4">
        <Link
          href={isSignedIn ? "/app" : "/"}
          className="font-serif text-[22px] font-medium tracking-tight text-ink"
        >
          Vesperdrop
        </Link>

        {isSignedIn ? (
          <nav className="hidden items-center gap-8 text-[14px] text-ink-3 md:flex">
            {SIGNED_IN_LINKS.map((link) => {
              const isActive = active === link.key;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative pb-1 transition-colors hover:text-ink",
                    isActive
                      ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-terracotta"
                      : "text-ink-3",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <nav className="hidden items-center gap-8 text-[14px] text-ink-3 md:flex">
            <Link
              href="/discover"
              className={cn(
                "relative pb-1 transition-colors hover:text-ink",
                active === "discover"
                  ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-terracotta"
                  : "text-ink-3",
              )}
            >
              Discover
            </Link>
            <Link href="/#how" className="text-ink-3 transition-colors hover:text-ink">
              How it works
            </Link>
            <Link href="/pricing" className="text-ink-3 transition-colors hover:text-ink">
              Pricing
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-3">
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
              <span
                className="hidden text-[13px] text-ink-3 md:inline"
                title={email}
              >
                {firstName ?? email}
              </span>
              <form action="/api/auth/sign-out" method="post" className="hidden md:block">
                <button
                  type="submit"
                  className="text-[13px] text-ink-3 transition-colors hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden text-[14px] text-ink-3 transition-colors hover:text-ink md:inline"
              >
                Log in
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
