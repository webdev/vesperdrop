import Link from "next/link";
import {
  BadgeCheck,
  Clock,
  CreditCard,
  Crown,
  Gift,
  Layers,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { BeforeAfterCarousel } from "./before-after-carousel";

export function Hero() {
  return (
    <section className="relative">
      <Container width="marketing" className="pb-6 pt-6 md:pb-20 md:pt-20">
        {/* Stacked at mobile/tablet (matches the IG ad bet — headline first),
            side-by-side at lg+ so the carousel stays in the desktop viewport
            (VES-9 acceptance: hero imagery entirely above the fold). The
            carousel still lives in DOM order *after* the headline column, so
            the brief's "visual below headline" reading order is preserved. */}
        <div className="grid grid-cols-1 items-center gap-6 md:gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3 md:text-[11px]">
              For Etsy, Shopify &amp; Amazon apparel sellers
            </p>

            {/* Single <h1>; mobile and desktop copy use CSS visibility, not duplicate tags. */}
            <h1 className="mt-4 text-[clamp(2rem,5vw,4.5rem)] font-serif leading-[1.02] tracking-[-0.02em] text-ink md:mt-5 md:text-[clamp(2.4rem,5.5vw,4.5rem)]">
              <span className="md:hidden">
                Apparel photos that look{" "}
                <em className="not-italic font-serif italic text-terracotta-dark">
                  premium
                </em>
                .
              </span>
              <span className="hidden md:inline">
                Lifestyle photography that makes your apparel look{" "}
                <em className="not-italic font-serif italic text-terracotta-dark">
                  premium
                </em>
                .
              </span>
            </h1>

            {/* Mobile subhead — value-prop framing per VES-31. Desktop keeps the risk-reversal copy below. */}
            <p className="mt-4 max-w-[20rem] text-[15px] leading-[1.5] text-ink-3 md:hidden">
              Studio-quality photos, made for your product.
            </p>

            {/* Desktop subhead — risk reversal */}
            <p className="mt-5 hidden max-w-xl text-[16px] leading-[1.55] text-ink-3 md:block">
              Get your first photo free. No card required.
            </p>

            <div className="mt-5 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center md:mt-7 lg:justify-start">
              <Link
                href="/try"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-4 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark sm:w-auto md:px-6 md:py-3.5"
              >
                Get my first photo free
                <span aria-hidden>→</span>
              </Link>
              {/* Hidden on mobile — lowest-value CTA above the fold */}
              <Link
                href="#how"
                className="hidden items-center justify-center gap-2 rounded-full border border-line bg-paper-soft px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2 md:inline-flex"
              >
                See how it works
              </Link>
            </div>

            {/* Mobile trust row — icons + mid-dot dividers (VES-32) */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 md:hidden">
              <span className="inline-flex items-center gap-1.5">
                <Gift aria-hidden="true" className="h-3.5 w-3.5" />
                First one&rsquo;s on us
              </span>
              <span aria-hidden="true">&middot;</span>
              <span className="inline-flex items-center gap-1.5">
                <CreditCard aria-hidden="true" className="h-3.5 w-3.5" />
                No card
              </span>
              <span aria-hidden="true">&middot;</span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                No spam
              </span>
            </div>

            {/* Desktop trust caption — plain text, unchanged */}
            <p className="mt-3 hidden font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 md:block">
              First one&rsquo;s on us &middot; No card &middot; No spam
            </p>
          </div>

          {/* Carousel column. Stacked under the copy block at mobile/tablet,
              shares the row at lg+. lg:mt-0 cancels the mobile vertical gap. */}
          <div className="mt-2 lg:mt-0">
            <BeforeAfterCarousel />
          </div>
        </div>

        <dl className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 border-t border-line-soft pt-6 sm:grid-cols-4 md:mt-16">
          <Stat icon={Layers} label="Per batch" value="6 photos" />
          <Stat icon={Clock} label="Time" value="~90 sec" />
          <Stat icon={BadgeCheck} label="Marketplace" value="A+ ready" />
          <Stat icon={Crown} label="Pro from" value="$39/mo" />
        </dl>

        {/* Mobile-only positioning statement — VES-35 (option b, no numeric claims). */}
        <p className="mt-5 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 md:hidden">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-terracotta" />
          Built for Etsy &amp; Shopify sellers
        </p>
      </Container>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 sm:block">
      {/* Mobile-only icon circle — VES-34. Hidden at sm: so desktop is pixel-identical. */}
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 sm:hidden"
      >
        <Icon className="h-4 w-4 text-ink-3" />
      </span>
      <div>
        <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
          {label}
        </dt>
        <dd className="mt-1.5 font-serif text-[20px] leading-none tracking-[-0.01em] text-ink">
          {value}
        </dd>
      </div>
    </div>
  );
}
