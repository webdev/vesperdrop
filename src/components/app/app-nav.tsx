import Link from "next/link";

export function AppNav({ firstName, email }: { firstName: string | null; email: string }) {
  const isSignedIn = email.length > 0;
  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href={isSignedIn ? "/app" : "/"} className="font-serif text-xl">
          Vesperdrop
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/app/discover" className="underline">
            Discover
          </Link>
          {isSignedIn ? (
            <>
              <span className="text-zinc-700">
                Hello, {firstName ?? email}
              </span>
              <Link href="/app/history" className="underline">
                History
              </Link>
              <Link href="/account" className="underline">
                Account
              </Link>
              <form action="/api/auth/sign-out" method="post">
                <button
                  type="submit"
                  className="text-zinc-500 hover:text-zinc-900"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
