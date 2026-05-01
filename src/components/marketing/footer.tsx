import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 text-[13px] text-zinc-500 md:flex-row md:items-center md:px-10">
        <div className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-5 w-5 rounded-full bg-zinc-900" />
          <span className="font-medium text-zinc-900">Vesperdrop</span>
          <span className="ml-2">© 2026</span>
        </div>
        <div className="flex flex-wrap gap-6">
          <Link href="/pricing" className="hover:text-zinc-900">
            Pricing
          </Link>
          <Link href="/try" className="hover:text-zinc-900">
            Try free
          </Link>
          <Link href="/sign-in" className="hover:text-zinc-900">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
