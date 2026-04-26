import Link from "next/link";

export function AppNav({ email }: { email: string }) {
  return (
    <nav className="border-b border-[var(--color-line)] bg-[var(--color-paper)]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/app" className="font-serif text-xl">
          Darkroom
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--color-ink-3)]">{email}</span>
          <Link href="/account" className="underline">
            Account
          </Link>
          <form action="/api/auth/sign-out" method="post">
            <button
              type="submit"
              className="text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
