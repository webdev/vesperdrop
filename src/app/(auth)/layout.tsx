import Link from "next/link";

const QUOTES = [
  { text: "Tripled my conversion rate the first week.", handle: "@oakandlinen" },
  { text: "Sold out in three days. Buyers thought I had a real studio.", handle: "@bloomintimates" },
  { text: "I shoot on a bedsheet. Customers see Vogue.", handle: "@plisséstudio" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Left panel — brand + social proof */}
      <div className="hidden md:flex flex-col justify-between border-r border-[var(--color-line)] bg-[var(--color-paper-2)] px-12 py-14">
        <Link
          href="/"
          className="font-serif text-4xl font-light italic leading-none tracking-tight text-[var(--color-ink)]"
        >
          Verceldrop
        </Link>

        <div className="space-y-10">
          <p className="font-serif text-2xl font-light leading-snug text-[var(--color-ink)]">
            Lifestyle photos from a product shot.{" "}
            <span className="italic text-[var(--color-ember)]">In 90 seconds.</span>
          </p>

          <ul className="space-y-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-2)]">
            <li className="flex items-center gap-3">
              <span className="text-[var(--color-ember)]">✓</span>
              3 free shots — no card required
            </li>
            <li className="flex items-center gap-3">
              <span className="text-[var(--color-ember)]">✓</span>
              Amazon A+ resolution (2000px)
            </li>
            <li className="flex items-center gap-3">
              <span className="text-[var(--color-ember)]">✓</span>
              First batch ready in ~90 seconds
            </li>
            <li className="flex items-center gap-3">
              <span className="text-[var(--color-ember)]">✓</span>
              Cancel any time
            </li>
          </ul>

          <div className="space-y-6 border-t border-[var(--color-line)] pt-8">
            {QUOTES.map((q) => (
              <div key={q.handle}>
                <p className="font-serif text-base italic leading-snug text-[var(--color-ink-2)]">
                  &ldquo;{q.text}&rdquo;
                </p>
                <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-[var(--color-ember)]">
                  — {q.handle}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)]">
          &copy; 2026 VERCELDROP STUDIO
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center px-6 py-16 md:px-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
