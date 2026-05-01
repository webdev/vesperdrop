import Link from "next/link";
import { BeforeAfter, type Pair } from "./before-after";

const PAIRS: Pair[] = [
  {
    sku: "CAM-001",
    name: "Cami",
    surface: "Hanger flatlay",
    scene: "Velvet glow",
    before: "/marketing/before-after/cami_before.png",
    after: "/marketing/before-after/cami_after.png",
  },
  {
    sku: "JKT-204",
    name: "Jacket",
    surface: "Studio rack",
    scene: "Urban canvas",
    before: "/marketing/before-after/jacket_before.png",
    after: "/marketing/before-after/jacket_after.png",
  },
  {
    sku: "SKT-018",
    name: "Skirt",
    surface: "Floor flatlay",
    scene: "Warm retreat",
    before: "/marketing/before-after/skirt_before.png",
    after: "/marketing/before-after/skirt_after.png",
  },
  {
    sku: "LCE-115",
    name: "Lace",
    surface: "Studio floor",
    scene: "Studio athletic",
    before: "/marketing/before-after/lace_before.png",
    after: "/marketing/before-after/lace_after.png",
  },
];

export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-20 md:px-10 md:pt-24 md:pb-28">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="order-2 md:order-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium tracking-wide text-zinc-600 uppercase">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live · 6 photos · 90 seconds
            </span>
            <h1 className="mt-5 text-[clamp(40px,6vw,84px)] font-semibold leading-[1.02] tracking-[-0.025em] text-zinc-900">
              Lifestyle photography
              <br />
              <span className="text-zinc-600">from a single</span>
              <br />
              product shot.
            </h1>
            <p className="mt-6 max-w-md text-[18px] leading-[1.55] text-zinc-600">
              Drop your flatlay. Pick a few looks. Get a 6-image batch — the
              kind of photography agencies charge $1,200 for, finished while
              you make coffee.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Link
                href="/try"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-7 py-3.5 text-[15px] font-medium text-white transition-transform hover:scale-[1.02] hover:bg-zinc-800"
              >
                Try with your photo
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-6 py-3.5 text-[15px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                See how it works
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-zinc-500">
              <Trust label="3 free shots" />
              <Trust label="No card" />
              <Trust label="A+ ready" />
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-6 -z-10 rounded-[28px] bg-gradient-to-br from-orange-100 via-rose-100 to-amber-100 opacity-70 blur-2xl"
              />
              <div className="relative overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-[0_30px_70px_-20px_rgba(15,15,15,0.20)]">
                <BeforeAfter pairs={PAIRS} />
              </div>
              <p className="mt-3 text-center text-[12px] text-zinc-500">
                Drag the slider — these are real generations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Trust({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="text-emerald-600"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {label}
    </span>
  );
}
