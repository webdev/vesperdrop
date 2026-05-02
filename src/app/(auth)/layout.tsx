import Link from "next/link";

const QUOTES = [
  { text: "Tripled my conversion rate the first week.", handle: "@oakandlinen" },
  { text: "Sold out in three days. Buyers thought I had a real studio.", handle: "@bloomintimates" },
  { text: "I shoot on a bedsheet. Customers see Vogue.", handle: "@plisséstudio" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-paper text-ink md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line-soft bg-paper-soft px-10 py-12 md:flex md:px-14 md:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-terracotta-soft/55 via-terracotta-wash/40 to-transparent blur-3xl"
        />
        <Link
          href="/"
          className="relative font-serif text-[22px] font-medium tracking-tight text-ink"
        >
          Vesperdrop
        </Link>

        <div className="relative space-y-10">
          <p className="font-serif text-[clamp(2rem,3vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ink">
            Lifestyle photos from a product shot.{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              In 90 seconds.
            </em>
          </p>

          <ul className="space-y-3 text-[14px] text-ink-2">
            <Bullet>3 free shots — no card required</Bullet>
            <Bullet>Amazon A+ resolution (2000px)</Bullet>
            <Bullet>First batch ready in ~90 seconds</Bullet>
            <Bullet>Cancel any time</Bullet>
          </ul>

          <div className="space-y-5 border-t border-line-soft pt-7">
            {QUOTES.map((q) => (
              <figure key={q.handle}>
                <blockquote className="font-serif text-[16px] leading-[1.45] tracking-[-0.005em] text-ink">
                  &ldquo;{q.text}&rdquo;
                </blockquote>
                <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
                  — {q.handle}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <p className="relative font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
          © 2026 Vesperdrop
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16 md:px-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0 text-terracotta"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {children}
    </li>
  );
}
