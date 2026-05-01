import Link from "next/link";

const QUOTES = [
  { text: "Tripled my conversion rate the first week.", handle: "@oakandlinen" },
  { text: "Sold out in three days. Buyers thought I had a real studio.", handle: "@bloomintimates" },
  { text: "I shoot on a bedsheet. Customers see Vogue.", handle: "@plisséstudio" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-white text-zinc-900 md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-zinc-200 bg-zinc-50/60 px-10 py-12 md:flex md:px-14 md:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-br from-orange-200/60 via-rose-200/40 to-transparent blur-3xl"
        />
        <Link
          href="/"
          className="relative flex items-center gap-2 text-[18px] font-semibold tracking-tight text-zinc-900"
        >
          <span aria-hidden className="inline-block h-6 w-6 rounded-full bg-zinc-900" />
          Vesperdrop
        </Link>

        <div className="relative space-y-10">
          <p className="text-[clamp(28px,3vw,40px)] font-semibold leading-[1.1] tracking-[-0.02em] text-zinc-900">
            Lifestyle photos from a product shot.{" "}
            <span className="text-zinc-500">In 90 seconds.</span>
          </p>

          <ul className="space-y-3 text-[14px] text-zinc-600">
            <Bullet>3 free shots — no card required</Bullet>
            <Bullet>Amazon A+ resolution (2000px)</Bullet>
            <Bullet>First batch ready in ~90 seconds</Bullet>
            <Bullet>Cancel any time</Bullet>
          </ul>

          <div className="space-y-5 border-t border-zinc-200 pt-7">
            {QUOTES.map((q) => (
              <figure key={q.handle}>
                <blockquote className="text-[15px] leading-[1.5] text-zinc-700">
                  &ldquo;{q.text}&rdquo;
                </blockquote>
                <figcaption className="mt-1 text-[12px] text-zinc-500">
                  — {q.handle}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] tracking-[0.18em] text-zinc-400 uppercase">
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
        className="shrink-0 text-emerald-600"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {children}
    </li>
  );
}
