import Link from "next/link";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden bg-zinc-900 py-24 text-white md:py-32">
      <div
        aria-hidden
        className="absolute inset-0 -z-0 bg-gradient-to-br from-orange-500/20 via-rose-500/10 to-transparent blur-3xl"
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center md:px-10">
        <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-400 uppercase">
          Three free shots, on us
        </p>
        <h2 className="mt-4 text-[clamp(36px,5.5vw,72px)] font-semibold leading-[1.05] tracking-[-0.025em] text-white">
          Stop reshooting.
          <br />
          <span className="text-zinc-400">Start producing.</span>
        </h2>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/try"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium text-zinc-900 transition-transform hover:scale-[1.02]"
          >
            Try with your photo
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-6 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-white/5"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
