import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ember)] uppercase">
          Private Preview
        </p>
        <h1 className="font-serif text-3xl font-light text-[var(--color-ink)]">
          Access restricted
        </h1>
        <p className="text-sm text-[var(--color-ink-2)] leading-relaxed">
          This site is in private development. Your account hasn&apos;t been
          granted access yet.
        </p>
        <Link
          href="/sign-in"
          className="inline-block font-mono text-xs tracking-[0.14em] uppercase text-[var(--color-ink-3)] underline underline-offset-4 hover:text-[var(--color-ink)] transition-colors"
        >
          Sign in with a different account
        </Link>
      </div>
    </main>
  );
}
