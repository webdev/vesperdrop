import Link from "next/link";
import { Container } from "@/components/ui/container";

export function Footer() {
  return (
    <footer className="border-t border-line-soft bg-paper py-12">
      <Container width="marketing" className="flex flex-col items-start justify-between gap-6 text-[13px] text-ink-3 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <span className="font-serif text-[18px] font-medium tracking-tight text-ink">
            Vesperdrop
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
            © 2026
          </span>
        </div>
        <div className="flex flex-wrap gap-6 font-mono text-[11px] uppercase tracking-[0.12em]">
          <Link href="/discover" className="text-ink-3 transition-colors hover:text-ink">
            Discover
          </Link>
          <Link href="/pricing" className="text-ink-3 transition-colors hover:text-ink">
            Pricing
          </Link>
          <Link href="/try" className="text-ink-3 transition-colors hover:text-ink">
            Try free
          </Link>
          <Link href="/sign-in" className="text-ink-3 transition-colors hover:text-ink">
            Sign in
          </Link>
        </div>
      </Container>
    </footer>
  );
}
